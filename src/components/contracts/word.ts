import JSZip from '../../../packages/contract-engine/browser/zip.js'
import templateUrl from './sales-v1.docx?url&inline'
import { parseLira, formatLira, liraInWords } from '@/utils/promissoryNotes'
import { decodeFile, type Contract } from './contracts'

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const RP='http://schemas.openxmlformats.org/package/2006/relationships'
const CT='http://schemas.openxmlformats.org/package/2006/content-types'
export const wordMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
function parse(xml:string) {
  const x=new DOMParser().parseFromString(xml,'application/xml')
  if(x.getElementsByTagName('parsererror').length)throw Error('Word belgesi okunamadı.')
  return x
}
const serialize=(x:Document)=>new XMLSerializer().serializeToString(x)
const nodes=(p:Element|Document,tag:string)=>Array.from(p.getElementsByTagNameNS(W,tag))
function paragraph(x:Document,text:string,right=false) {
  const p=x.createElementNS(W,'w:p'),r=x.createElementNS(W,'w:r'),t=x.createElementNS(W,'w:t')
  if(right){const pr=x.createElementNS(W,'w:pPr'),jc=x.createElementNS(W,'w:jc');jc.setAttributeNS(W,'w:val','right');pr.append(jc);p.append(pr)}
  t.textContent=text;r.append(t);p.append(r);return p
}
export async function inspectWord(bytes:Uint8Array) {
  const zip=await JSZip.loadAsync(bytes)
  const entries=Object.values(zip.files)
  const total=entries.reduce((n,e)=>n+Number((e as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize || 0),0)
  if(total>48*1024*1024 || entries.length>3000 || !zip.file('word/document.xml'))throw Error('Bu dosya desteklenen bir Word belgesi değil.')
  // Embedded active content is inappropriate for an in-app reader. Strip external relationships from derivative copies.
  if(entries.some(e=>/vbaProject|^word\/(activeX|embeddings)\//i.test(e.name)))throw Error('Makro veya gömülü program içeren dosya yüklenemez.')
  for(const e of entries.filter(e=>e.name.endsWith('.rels'))) {
    const rel=parse(await e.async('string'))
    for(const el of Array.from(rel.documentElement.children))if(el.getAttribute('TargetMode')==='External')el.remove()
    zip.file(e.name,serialize(rel))
  }
  const xml=parse(await zip.file('word/document.xml')!.async('string'))
  return {zip,xml}
}
function trDate(value:string) {return /^\d{4}-\d{2}-\d{2}$/.test(value || '')?value.split('-').reverse().join('.'):value || ''}
function documentsValues(c:Contract) {
  const f=c.fields,cents=parseLira(f.price || '')
  return {...f,date:trDate(f.date),delivery:trDate(f.delivery),priceDisplay:cents===null?'':formatLira(cents)+' TL',
    priceWords:cents===null?'':liraInWords(cents).toLocaleUpperCase('tr-TR')}
}
const template=()=>fetch(templateUrl).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b))
export async function buildWord(c:Contract, forEditing=false) {
  const {xml,zip}=await inspectWord(c.format==='docx'?decodeFile(c.file!):await template())
  const body=nodes(xml,'body')[0]
  if(c.format==='legacy') {
    for(const p of Array.from(body.children))if(p.localName!=='sectPr')p.remove()
    for(const text of [c.title,c.name,c.fields.beneficiary,c.fields.phone,c.fields.identityNo,c.fields.address,c.fields.property,c.fields.amount,c.fields.body].filter(Boolean))
      body.insertBefore(paragraph(xml,text),nodes(body,'sectPr')[0]||null)
  }
  const values:Record<string,string>=documentsValues(c)
  const editable:{key:string;text:string}[]=[]
  nodes(body,'p').forEach((p,i)=>{
    const ts=nodes(p,'t'),original=ts.map(t=>t.textContent).join(''),key='paragraph.'+i
    const templated=c.format==='template-v1' && /\{\{\w+\}\}/.test(original)
    if(!original.trim() || original.trim().startsWith('SÖZLEŞME NO.:'))return
    if(templated) {
      for(const t of ts)t.textContent=(t.textContent||'').replace(/\{\{(\w+)\}\}/g,(_,k)=>values[k]||'')
    } else {
      const replacement=c.fields[key]
      if(replacement!==undefined && replacement!==original){ts[0].textContent=replacement;for(const t of ts.slice(1))t.textContent=''}
      editable.push({key,text:replacement??original})
    }
  })
  const first=body.firstElementChild
  if(first?.localName==='p' && first.textContent?.trim().startsWith('SÖZLEŞME NO.:'))first.remove()
  body.insertBefore(paragraph(xml,'SÖZLEŞME NO.: '+(c.number || 'Kaydedilince verilir'),true),body.firstChild)
  zip.file('word/document.xml',serialize(xml))
  return {editable, bytes:forEditing?new Uint8Array():await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})}
}

export async function imagePagesWord(pages:AsyncIterable<HTMLCanvasElement>) {
  const {zip,xml}=await inspectWord(await template()), body=nodes(xml,'body')[0],sect=nodes(body,'sectPr')[0]
  for(const el of Array.from(body.children))if(el!==sect)el.remove()
  const mar=nodes(sect,'pgMar')[0]
  for(const side of ['left','right','top','bottom'])mar.setAttributeNS(W,'w:'+side,'280')
  const rel=parse(await zip.file('word/_rels/document.xml.rels')!.async('string'))
  const ct=parse(await zip.file('[Content_Types].xml')!.async('string'))
  if(!Array.from(ct.documentElement.children).some(x=>x.getAttribute('Extension')==='png')){
    const def=ct.createElementNS(CT,'Default');def.setAttribute('Extension','png');def.setAttribute('ContentType','image/png');ct.documentElement.append(def)
  }
  let i=0
  for await (const canvas of pages) {
    i++
    const rid='contractPage'+i, path='media/contract-page-'+i+'.png'
    zip.file('word/'+path,canvas.toDataURL('image/png').split(',')[1],{base64:true})
    const el=rel.createElementNS(RP,'Relationship');el.setAttribute('Id',rid);el.setAttribute('Type',R+'/image');el.setAttribute('Target',path);rel.documentElement.append(el)
    const scale=Math.min(7120000/canvas.width,9900000/canvas.height),cx=Math.round(canvas.width*scale),cy=Math.round(canvas.height*scale)
    const node=parse(`<w:p xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:pPr>${i>1?'<w:pageBreakBefore/>':''}<w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${i}" name="Sayfa ${i}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i}" name="Sayfa ${i}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`)
    body.insertBefore(xml.importNode(node.documentElement,true),sect)
  }
  zip.file('word/document.xml',serialize(xml));zip.file('word/_rels/document.xml.rels',serialize(rel));zip.file('[Content_Types].xml',serialize(ct))
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
}

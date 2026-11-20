import { buildWord, imagePagesWord, wordMime } from './word'
import { decodeFile, type Contract } from './contracts'

export async function *pdfPages(bytes:Uint8Array, width=1100) {
  const pdfjs=await import('../../../packages/contract-engine/browser/reader.js')
  if(!pdfjs.GlobalWorkerOptions.workerPort){
    const {default:Worker}=await import('../../../packages/contract-engine/browser/worker.js?worker&inline')
    pdfjs.GlobalWorkerOptions.workerPort=new Worker()
  }
  const task=pdfjs.getDocument({data:bytes.slice(),useSystemFonts:true,disableFontFace:false,useWasm:false})
  try {
    const doc=await task.promise
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i),unit=page.getViewport({scale:1})
      const viewport=page.getViewport({scale:Math.min(width/unit.width,1800/unit.height)})
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
      await page.render({canvas,viewport}).promise
      yield canvas;page.cleanup()
    }
  }finally{await task.destroy()}
}

async function numberedPdf(c:Contract) {
  const {PDFDocument}=await import('../../../packages/contract-engine/browser/pdf.js'), pdf=await PDFDocument.load(decodeFile(c.file!))
  const p=pdf.getPages()[0];if(!p)throw Error('PDF sayfası bulunamadı.')
  // Expand the first page so the number does not obscure any original content.
  const box=p.getCropBox(),media=p.getMediaBox(), strip=25
  p.setMediaBox(media.x,media.y,media.width,media.height+strip)
  p.setCropBox(box.x,box.y,box.width,box.height+strip)
  const canvas=document.createElement('canvas');canvas.width=750;canvas.height=52
  const ctx=canvas.getContext('2d')!;ctx.font='bold 30px Arial';ctx.textAlign='right';ctx.fillText('SÖZLEŞME NO.: '+(c.number||'Kaydedilince verilir'),742,38)
  const img=await pdf.embedPng(canvas.toDataURL('image/png')),w=Math.min(225,box.width-8)
  p.drawImage(img,{x:box.x+box.width-w-4,y:box.y+box.height+4,width:w,height:w*52/750})
  return pdf.save()
}

export function createWordFrame() {
  const frame=document.createElement('iframe')
  frame.title='Sözleşme sayfaları';frame.setAttribute('sandbox','allow-same-origin')
  return frame
}
export async function renderWord(frame:HTMLIFrameElement,bytes:Uint8Array) {
  const {renderAsync}=await import('../../../packages/contract-engine/browser/word.js')
  const d=frame.contentDocument
  if(!d)throw Error('Belge okuyucu açılamadı.')
  d.open();d.write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data: blob:"><style>html,body{margin:0;background:#ebe9e5;color:#171717}section.docx{margin:12px auto!important;box-shadow:0 1px 5px #0002}section.docx p{overflow-wrap:anywhere}</style></head><body></body></html>');d.close()
  const content=d.createElement('main');d.body.append(content)
  await renderAsync(bytes,content,d.head,{inWrapper:false,useBase64URL:true,renderAltChunks:false,ignoreLastRenderedPageBreak:true})
  await Promise.all(Array.from(content.querySelectorAll('img')).map(im=>im.decode().catch(()=>{})))
  await d.fonts.ready
  return content
}
async function wordPdf(bytes:Uint8Array) {
  const [{PDFDocument},{default:capture}]=await Promise.all([import('../../../packages/contract-engine/browser/pdf.js'),import('../../../packages/contract-engine/browser/canvas.js')])
  const frame=createWordFrame();frame.style.cssText='position:fixed;left:-12000px;top:0;width:1000px;height:1200px;border:0;pointer-events:none'
  document.body.append(frame)
  try {
    const root=await renderWord(frame,bytes),out=await PDFDocument.create()
    for(const sheet of Array.from(root.querySelectorAll<HTMLElement>('section.docx'))){
      const rect=sheet.getBoundingClientRect(),css=getComputedStyle(sheet)
      const pageHeight=parseFloat(css.minHeight)||rect.width*297/210
      // Prefer paragraph boundaries when long content flows beyond the paper.
      const stops=Array.from(sheet.querySelectorAll('p,tr')).map(p=>p.getBoundingClientRect().top-rect.top)
      const canvas=await capture(sheet,{scale:1.5,backgroundColor:'#ffffff',logging:false})
      const factor=canvas.width/rect.width
      for(let top=0;top<canvas.height-1;){
        let bottom=Math.min(canvas.height,top+Math.round(pageHeight*factor))
        if(bottom<canvas.height-3){
          const stop=stops.map(y=>Math.round(y*factor)).filter(y=>y>top+pageHeight*factor*.6&&y<=bottom).at(-1)
          if(stop)bottom=stop
        }
        const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=bottom-top
        slice.getContext('2d')!.drawImage(canvas,0,top,canvas.width,slice.height,0,0,canvas.width,slice.height)
        const img=await out.embedJpg(slice.toDataURL('image/jpeg',.95))
        const page=out.addPage([rect.width*.75,pageHeight*.75]),height=slice.height/factor*.75
        page.drawImage(img,{x:0,y:page.getHeight()-height,width:page.getWidth(),height})
        top=bottom
      }
    }
    if(!out.getPageCount())throw Error('Belge sayfaları okunamadı.')
    return out.save()
  }finally{frame.remove()}
}
export async function documentBytes(c:Contract,format:'pdf'|'docx') {
  if(c.format==='pdf'){
    const pdf=await numberedPdf(c)
    return format==='pdf'?pdf:imagePagesWord(pdfPages(pdf,1500))
  }
  const {bytes}=await buildWord(c)
  return format==='docx'?bytes:wordPdf(bytes)
}
export async function downloadDocument(c:Contract,format:'pdf'|'docx') {
  const bytes=await documentBytes(c,format)
  const url=URL.createObjectURL(new Blob([Uint8Array.from(bytes)],{type:format==='pdf'?'application/pdf':wordMime}))
  const a=document.createElement('a');a.href=url;a.download=(c.number||'Sözleşme').replaceAll('/','-')+' - '+c.name.replace(/[<>:"/\\|?*]/g,' ').slice(0,80)+'.'+format
  a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
}

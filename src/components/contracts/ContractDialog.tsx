import {useEffect,useRef,useState,type FormEvent} from 'react'
import {FilePlus2,Upload,Download,Pencil,Trash2} from 'lucide-react'
import {GlassModal} from '@/components/ui/GlassModal'
import {userStore} from '@/services/userStore'
import {formatLira,parseLira} from '@/utils/promissoryNotes'
import {customers,encodeFile,openContract,sections,statuses,writeContract,type Customer,type Contract} from './contracts'
import {ContractReader} from './ContractReader'
import {buildWord,inspectWord} from './word'
import {documentBytes,downloadDocument} from './documents'

type Step='choose'|'fields'|'upload'|'editor'|'read'|'delete'
export function ContractDialog({initial,fromCard,onClose,onSaved}:{initial:Contract;fromCard:boolean;onClose:()=>void;onSaved:()=>void}) {
  const [doc,setDoc]=useState(initial),[step,setStep]=useState<Step>(initial.revision?'read':'choose')
  const [stored,setStored]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [changedFile,setChangedFile]=useState(false),[downloads,setDownloads]=useState(false),[editText,setEditText]=useState(false)
  const [paragraphs,setParagraphs]=useState<{key:string;text:string}[]>([])
  const [query,setQuery]=useState(''),[matches,setMatches]=useState<Customer[]>([])
  const locked=useRef(false), op=useRef<{doc:Contract;remove:boolean;request:string}|null>(null)
  const advisors=userStore.getAll().filter(x=>x.department==='Satış'||x.departments?.includes('Satış'))
  const field=(key:string,value:string)=>setDoc(d=>({...d,fields:{...d.fields,[key]:value},...(key==='buyer'?{name:value}:{})}))
  useEffect(()=>{
    if(!query.trim()||fromCard||doc.lead_id){setMatches([]);return}
    let active=true
    const timer=setTimeout(()=>customers(query).then(list=>{if(active)setMatches(list)}).catch(e=>{if(active)setError(e.message)}),250)
    return ()=>{active=false;clearTimeout(timer)}
  },[query,fromCard,doc.lead_id])
  function chooseCustomer(c:Customer){
    const advisor=advisors.find(a=>a.id===c.advisor)
    setDoc(d=>({...d,name:c.name,lead_id:c.id,advisor_id:advisor?.id||null,fields:{...d.fields,buyer:c.name,phone:c.phone,advisor:advisor?.fullName||d.fields.advisor||''}}))
    setQuery('');setMatches([])
  }
  function act(fn:()=>Promise<void>){
    if(locked.current)return
    locked.current=true;setBusy(true);setError('')
    void fn().catch(e=>setError(e instanceof Error?e.message:'İşlem tamamlanamadı.')).finally(()=>{locked.current=false;setBusy(false)})
  }
  async function readFile(file:File){
    if(file.size>8*1024*1024||!file.size)throw Error('8 MB’a kadar bir PDF veya DOCX seçin.')
    const bytes=new Uint8Array(await file.arrayBuffer()), ext=file.name.split('.').pop()?.toLowerCase()
    if(ext!=='pdf'&&ext!=='docx')throw Error('PDF veya DOCX dosyası seçin.')
    if(ext==='docx')await inspectWord(bytes)
    else {const {PDFDocument}=await import('../../../packages/contract-engine/browser/pdf.js');const pdf=await PDFDocument.load(bytes);if(!pdf.getPageCount())throw Error('PDF dosyası boş.')}
    setChangedFile(true);setDoc(d=>({...d,format:ext,file:encodeFile(bytes),title:file.name.replace(/\.(docx|pdf)$/i,''),
      fields:{...Object.fromEntries(Object.entries(d.fields).filter(([k])=>!k.startsWith('paragraph.'))),filename:file.name}}))
  }
  function advance(e:FormEvent){
    e.preventDefault();setError('')
    if(step==='upload'&&(!doc.file||!['docx','pdf'].includes(doc.format))){setError('PDF veya Word dosyasını seçin.');return}
    if(step==='fields'&&doc.format==='template-v1'){
      const amount=parseLira(doc.fields.price||'')
      if(amount===null||amount<=0){setError('Geçerli bir satış fiyatı girin.');return}
      setDoc(d=>({...d,fields:{...d.fields,price:formatLira(amount)}}))
    }
    setEditText(false);setStep('editor')
  }
  async function save(remove=false){
    if(!op.current || op.current.doc!==doc || op.current.remove!==remove)op.current={doc,remove,request:crypto.randomUUID()}
    await writeContract(doc,op.current.request,changedFile?doc.file:null,remove)
    onSaved()
    if(remove){onClose();return}
    const fresh=await openContract(doc.id)
    setDoc(fresh);setStored(fresh);setChangedFile(false);setDownloads(false);setEditText(false);setStep('read')
  }
  function back(){
    setError('');setDownloads(false)
    if(stored.revision){setDoc(stored);setChangedFile(false);setEditText(false);setStep('read')}
    else setStep('choose')
  }
  const title=step==='choose'?'Yeni sözleşme':step==='upload'?'Sözleşme yükle':step==='fields'?'Sözleşme bilgileri':step==='delete'?'Sözleşmeyi sil':step==='editor'?'Sözleşmeyi düzenle':doc.title
  const binding=<>
    {!fromCard&&!doc.lead_id&&<label className="contract-wide">Kayıtlı müşteriyle ilişkilendir<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ad veya telefonla ara" />
      {matches.length>0&&<span className="contract-results">{matches.map(c=><button type="button" key={c.id} onClick={()=>chooseCustomer(c)}>{c.name} · {c.phone}</button>)}</span>}
    </label>}
    {doc.lead_id&&<div className="contract-link contract-wide">Müşteri kaydı · {doc.name}{!initial.lead_id&&!fromCard&&<button type="button" onClick={()=>setDoc(d=>({...d,lead_id:null,advisor_id:null}))}>Bağlantıyı kaldır</button>}</div>}
    {!fromCard&&<label>İlgili satış danışmanı<select value={doc.advisor_id||''} onChange={e=>{const a=advisors.find(x=>x.id===e.target.value);setDoc(d=>({...d,advisor_id:a?.id||null,fields:{...d.fields,advisor:a?.fullName||''}}))}}>
      <option value="">Seçilmedi</option>{advisors.map(a=><option key={a.id} value={a.id}>{a.fullName}</option>)}</select></label>}
    <label>Durum<select value={doc.status} onChange={e=>setDoc(d=>({...d,status:e.target.value}))}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  </>
  return <GlassModal isOpen title={title} onClose={()=>{if(!locked.current)onClose()}} maxWidth={step==='choose'||step==='delete'?'lg':'5xl'}>
    <div className="contract-workflow" aria-busy={busy}>
    {error&&<p className="contract-error" role="alert">{error}</p>}
    {step==='choose'&&<div className="contract-choices">
      <button onClick={()=>setStep('upload')}><Upload size={22}/>Sözleşme yükle<small>PDF veya Word belgesi</small></button>
      <button onClick={()=>{setDoc(d=>({...d,format:'template-v1',file:null,title:initial.title}));setError('');setChangedFile(false);setStep('fields')}}><FilePlus2 size={22}/>Sözleşme oluştur<small>Şirketin satış sözleşmesi şablonu</small></button>
    </div>}
    {(step==='fields'||step==='upload')&&<form onSubmit={advance}><fieldset disabled={busy} className="contract-form">
      <div className="contract-grid">{binding}</div>
      {step==='upload'?<div className="contract-grid">
        <label>Alıcının adı soyadı<input required maxLength={500} value={doc.name} onChange={e=>field('buyer',e.target.value)}/></label>
        <label>Belge<input type="file" accept=".docx,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f)act(()=>readFile(f))}}/>{doc.fields.filename&&<small>{doc.fields.filename}</small>}</label></div>
      :doc.format==='legacy'?<div className="contract-grid">{Object.entries({name:'Alıcı',phone:'Telefon',beneficiary:'Firma',identityNo:'T.C. / Vergi no',address:'Adres',property:'Taşınmaz',amount:'Bedel',body:'Sözleşme metni'}).map(([k,label])=><label key={k}>{label}<textarea value={(k==='name'?doc.name:doc.fields[k])||''} onChange={e=>field(k==='name'?'buyer':k,e.target.value)}/></label>)}</div>
      :sections.map(([group,items])=><section key={group}><h4>{group}</h4><div className="contract-grid">{items.map(item=>{
        const [key,label]=item,type=item.length===3?item[2]:'text',required=['buyer','identity','phone','address','project','price','date','unit','delivery','seller'].includes(key)
        return <label key={key} className={type==='long'?'contract-wide':''}>{label}{type==='long'
          ?<textarea required={required} maxLength={5000} rows={2} value={doc.fields[key]||''} onChange={e=>field(key,e.target.value)}/>
          :<input required={required} maxLength={500} type={type} value={doc.fields[key]||''} onChange={e=>field(key,e.target.value)}/>}</label>
      })}</div></section>)}
      <div className="contract-actions"><button type="button" onClick={back}>Geri</button><button className="contract-primary">Belgeyi aç</button></div>
    </fieldset></form>}
    {(step==='editor'||step==='read')&&<>
      <div className="contract-toolbar"><strong>{doc.number||'Numara kaydederken verilir'}</strong>
      <div className="contract-actions">
      {step==='read'?<>
        <button disabled={busy} onClick={()=>setStep('delete')}><Trash2 size={14}/> Sil</button>
        <button disabled={busy} onClick={()=>{setStep(doc.format==='pdf'||doc.format==='docx'?'upload':'fields');setDownloads(false)}}><Pencil size={14}/> Düzenle</button>
        <button className="contract-primary" disabled={busy} aria-expanded={downloads} onClick={()=>setDownloads(!downloads)}><Download size={14}/> İndir</button>
      </>:<>
        <button disabled={busy} onClick={()=>{setEditText(false);setStep(['pdf','docx'].includes(doc.format)?'upload':'fields')}}>Bilgilere dön</button>
        {doc.format!=='pdf'&&<button disabled={busy} onClick={()=>act(async()=>{
          if(!editText)setParagraphs((await buildWord(doc,true)).editable)
          setEditText(!editText)
        })}>{editText?'Önizle':'Metni düzenle'}</button>}
        <button className="contract-primary" disabled={busy} onClick={()=>act(()=>save())}>Kaydet</button>
      </>}
      </div></div>
      {downloads&&step==='read'&&<div className="contract-actions">{(['docx','pdf'] as const).map(f=><button disabled={busy} key={f} onClick={()=>act(async()=>{await downloadDocument(doc,f);setDownloads(false)})}>{f==='docx'?'Word (.docx)':'PDF (.pdf)'}</button>)}</div>}
      {editText&&step==='editor'?<div className="contract-text-editor">{paragraphs.map(p=><textarea aria-label="Belge paragrafı" key={p.key} rows={Math.max(1,Math.min(6,Math.ceil(p.text.length/95)))} value={doc.fields[p.key]??p.text} onChange={e=>field(p.key,e.target.value)} />)}</div>:<ContractReader doc={doc}/>}
    </>}
    {step==='delete'&&<><p><strong>{doc.number}</strong> · {doc.name} için kaydedilmiş sözleşme silinsin mi?</p><div className="contract-actions"><button disabled={busy} onClick={back}>Vazgeç</button><button disabled={busy} className="contract-danger" onClick={()=>act(()=>save(true))}>Sözleşmeyi sil</button></div></>}
    {busy&&<p role="status">İşlem sürüyor…</p>}
    </div>
  </GlassModal>
}

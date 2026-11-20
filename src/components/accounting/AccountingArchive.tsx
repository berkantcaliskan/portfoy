import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {Archive,ChevronRight,Download,File,Folder,FolderPlus,Plus,Search} from 'lucide-react'
import {userStore} from '@/services/userStore'
import {GlassModal} from '@/components/ui/GlassModal'
import {decodeFile,encodeFile} from '@/components/contracts/contracts'
import './AccountingArchive.css'

interface Entry {id:string;parent_id:string|null;folder:boolean;name:string;category:string;customer:string;shelf:string;size:number;created_at:string}
const categories=['Sözleşme','Fatura','Dekont','Tapu','Diğer']
async function archiveRpc(name:string,args:Record<string,unknown>){
  const owner=userStore.getCurrentUser()?.id,client=userStore.getServerClient()
  if(!owner||!client)throw Error('Arşiv için oturum gerekli.')
  const res=await client.rpc(name,args).abortSignal(AbortSignal.timeout(60000))
  if(owner!==userStore.getCurrentUser()?.id)throw Error('Oturum değişti.')
  if(res.error)throw Error(res.error.code==='23505'?'Bu konumda aynı adlı bir klasör var.':'Sunucu arşiv işlemini doğrulayamadı. Tekrar deneyin.')
  return res.data
}
export function AccountingArchive(){
  const [rows,setRows]=useState<Entry[]>([]),[parent,setParent]=useState<string|null>(null),[query,setQuery]=useState(''),[category,setCategory]=useState('')
  const [draft,setDraft]=useState<{id:string;folder:boolean;parent:string|null}|null>(null),[name,setName]=useState(''),[kind,setKind]=useState(''),[customer,setCustomer]=useState(''),[shelf,setShelf]=useState('')
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[formError,setFormError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
  const version=useRef(0),lock=useRef(false)
  const refresh=useCallback(async()=>{
    const v=++version.current;setLoading(true);setError('')
    try{const result:Entry[]=[];for(;;){const batch=await archiveRpc('crm_archive_list',{p_after:result.at(-1)?.id||null}) as Entry[]
      result.push(...batch);if(batch.length<200)break}
      if(v===version.current)setRows(result)
    }catch(e){if(v===version.current)setError((e as Error).message)}finally{if(v===version.current)setLoading(false)}
  },[])
  useEffect(()=>{void refresh();window.addEventListener('focus',refresh);return ()=>{version.current++;window.removeEventListener('focus',refresh)}},[refresh])
  const folders=new Map(rows.filter(r=>r.folder).map(r=>[r.id,r]))
  function ancestors(id:string|null){const path:Entry[]=[],seen=new Set<string>()
    while(id&&!seen.has(id)){seen.add(id);const entry=folders.get(id);if(!entry)break;path.unshift(entry);id=entry.parent_id}return path}
  const search=query.toLocaleLowerCase('tr').trim()
  const filtered=rows.filter(r=>{
    if(!search&&!category)return r.parent_id===parent
    if(parent&&!ancestors(r.parent_id).some(a=>a.id===parent))return false
    return (!category||r.category===category)&&[r.name,r.customer,r.shelf,r.category].some(x=>x.toLocaleLowerCase('tr').includes(search))
  }).sort((a,b)=>Number(b.folder)-Number(a.folder)||a.name.localeCompare(b.name,'tr'))
  function navigate(id:string|null){setParent(id);setQuery('');setCategory('')}
  function start(folder:boolean){setDraft({id:crypto.randomUUID(),folder,parent});setName('');setKind('');setCustomer('');setShelf('');setFile(null);setFormError('')}
  async function save(e:FormEvent){e.preventDefault();if(!draft||lock.current)return
    if(!draft.folder&&(!file||file.size===0||file.size>8*1024*1024)){setFormError('8 MB’a kadar bir dosya seçin.');return}
    lock.current=true;setBusy(true);setFormError('')
    try{const id=await archiveRpc('crm_archive_add',{p_id:draft.id,p_parent:draft.parent,p_name:name.trim(),p_folder:draft.folder,p_category:kind,p_customer:customer,p_shelf:shelf,p_file:file?encodeFile(new Uint8Array(await file.arrayBuffer())):null})
      if(id!==draft.id)throw Error('Arşiv kaydı doğrulanamadı.')
      setDraft(null);navigate(draft.parent);await refresh()
    }catch(e){setFormError((e as Error).message)}finally{lock.current=false;setBusy(false)}
  }
  async function download(row:Entry){setError('');try{
    const body=await archiveRpc('crm_archive_file',{p_id:row.id});if(typeof body!=='string')throw Error('Dosya okunamadı.')
    const url=URL.createObjectURL(new Blob([decodeFile(body)],{type:'application/octet-stream'})),a=document.createElement('a')
    a.href=url;a.download=row.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(e){setError((e as Error).message)}}
  return <section className="account-archive"><header><h2><Archive/>Arşiv</h2><div><button onClick={()=>start(true)}><FolderPlus size={16}/>Klasör oluştur</button><button className="contract-primary" onClick={()=>start(false)}><Plus size={16}/>Dosya ekle</button></div></header>
    <nav aria-label="Klasör yolu"><button onClick={()=>navigate(null)}>Arşiv</button>{ancestors(parent).map(f=><span key={f.id}><ChevronRight size={14}/><button onClick={()=>navigate(f.id)}>{f.name}</button></span>)}</nav>
    <div className="archive-search"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Arşivde ara" placeholder="Dosya, müşteri veya raf ara"/></label>
      <select aria-label="Kategori filtresi" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tüm kategoriler</option>{Array.from(new Set([...categories,...rows.map(r=>r.category).filter(Boolean)])).map(k=><option key={k}>{k}</option>)}</select></div>
    {error&&<p role="alert">{error} <button onClick={refresh}>Tekrar dene</button></p>}
    <div className="archive-table"><table><thead><tr>{['Ad','Kategori','Müşteri','Dolap / raf','Eklenme tarihi',''].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.folder?<button onClick={()=>navigate(r.id)}><Folder size={16}/>{r.name}</button>:<span><File size={16}/>{r.name}</span>}</td><td>{r.category||'—'}</td><td>{r.customer||'—'}</td><td>{r.shelf||'—'}</td><td>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td><td>{!r.folder&&<button aria-label={r.name+' dosyasını indir'} onClick={()=>void download(r)}><Download size={15}/></button>}</td></tr>)}</tbody></table></div>
    {!filtered.length&&!error&&<p>{loading?'Arşiv yükleniyor…':query||category?'Bu filtreyle eşleşen kayıt yok.':'Klasör boş.'}</p>}
    <GlassModal isOpen={!!draft} title={draft?.folder?'Klasör oluştur':'Dosya ekle'} onClose={()=>{if(!busy)setDraft(null)}}>
      {draft&&<form className="archive-form" onSubmit={save}><fieldset disabled={busy}>
      {!draft.folder&&<label>Dosya<input type="file" required onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);setName(f?.name||'')}}/></label>}
      <label>{draft.folder?'Klasör adı':'Dosya adı'}<input required maxLength={240} value={name} onChange={e=>setName(e.target.value)}/></label>
      {!draft.folder&&<><label>Kategori<input aria-label="Kategori" list="archive-categories" maxLength={300} value={kind} onChange={e=>setKind(e.target.value)}/><datalist id="archive-categories">{categories.map(x=><option key={x}>{x}</option>)}</datalist></label>
      <label>Müşteri adı (isteğe bağlı)<input maxLength={300} value={customer} onChange={e=>setCustomer(e.target.value)}/></label>
      <label>Fiziksel dolap / raf (isteğe bağlı)<input maxLength={300} value={shelf} onChange={e=>setShelf(e.target.value)}/></label></>}
      {formError&&<p role="alert">{formError}</p>}<button className="contract-primary">{busy?'Kaydediliyor…':'Kaydet'}</button></fieldset></form>}
    </GlassModal></section>
}

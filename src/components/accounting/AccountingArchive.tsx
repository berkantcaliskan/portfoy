import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {Archive,ChevronRight,Download,File,FileText,Folder,FolderOpen,FolderPlus,Plus,Search} from 'lucide-react'
import {ContractsPage,useContractCount} from '@/components/contracts/ContractWorkspace'
import {userStore} from '@/services/userStore'
import {GlassModal} from '@/components/ui/GlassModal'
import {CustomSelect} from '@/components/ui/CustomSelect'
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
type ArchiveSection='contracts'|'files'
export function AccountingArchive(){
  const [section,setSection]=useState<ArchiveSection>('contracts')
  const contractCount=useContractCount()
  const tabs:{id:ArchiveSection;label:string;hint:string;icon:typeof FileText}[]=[
    {id:'files',label:'Dosya Arşivi',hint:'Fiziksel evrakların dijital kopyaları',icon:FolderOpen},
    {id:'contracts',label:'Sözleşmeler',hint:contractCount===null?'Satış ve ön ofis sözleşmeleri':`${contractCount} sözleşme kaydı`,icon:FileText},
  ]
  return <div className="space-y-5">
    <div className="flex items-center gap-2.5"><Archive className="w-5 h-5 text-[#b99881]"/><h2 className="text-2xl font-bold text-white tracking-wide">Arşiv</h2></div>
    <div role="tablist" aria-label="Arşiv bölümleri" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tabs.map(tab=>{const active=section===tab.id,Icon=tab.icon
        return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={()=>setSection(tab.id)}
          className={`flex items-center gap-4 rounded-[22px] border px-5 py-4 text-left transition-colors ${active?'bg-[#34302d] border-[var(--accent-color,#b99881)] shadow-sm':'bg-[#282522]/80 border-[#4a443f] hover:border-[#b99881]/60'}`}>
          <span className={`flex w-11 h-11 shrink-0 items-center justify-center rounded-2xl ${active?'bg-[var(--accent-color,#b99881)] text-white':'bg-[#34302d] text-[#b99881]'}`}><Icon className="w-5 h-5"/></span>
          <span className="min-w-0"><span className={`block text-base font-bold ${active?'text-white':'text-[#d6beae]'}`}>{tab.label}</span><span className="block text-xs text-[#a69f99] truncate">{tab.hint}</span></span>
        </button>})}
    </div>
    {section==='contracts'?<ContractsPage embedded/>:<ArchiveFiles/>}
  </div>
}
function ArchiveFiles(){
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
  const pill='flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white transition-colors'
  const categoryOptions=Array.from(new Set([...categories,...rows.map(r=>r.category).filter(Boolean)]))
  return <section className="account-archive space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      <div className="order-last ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className={pill} onClick={()=>start(true)}><FolderPlus className="w-3.5 h-3.5 text-[#b99881]"/>Klasör oluştur</button>
        <button type="button" className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b99881] hover:bg-[#c9a891] text-xs font-semibold text-[#1c1a18] transition-colors" onClick={()=>start(false)}><Plus className="w-3.5 h-3.5"/>Dosya ekle</button>
      </div>
      <nav aria-label="Klasör yolu" className="flex flex-wrap items-center gap-1 text-xs text-[#a69f99] mr-auto">
        <button type="button" onClick={()=>navigate(null)} className={`px-2 py-1 rounded-full hover:text-white ${parent?'':'text-white font-semibold'}`}>Arşiv</button>
        {ancestors(parent).map((f,i,all)=><span key={f.id} className="flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5 text-[#8c857f]"/><button type="button" onClick={()=>navigate(f.id)} className={`px-2 py-1 rounded-full hover:text-white ${i===all.length-1?'text-white font-semibold':''}`}>{f.name}</button></span>)}
      </nav>
      <div className="relative w-full sm:w-64">
        <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Arşivde ara" placeholder="Dosya, müşteri veya raf ara"
          className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"/>
      </div>
      <CustomSelect value={category} onChange={e=>setCategory(e.target.value)} title="Kategori filtresi"
        className="px-3.5 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white">
        <option value="">Tüm kategoriler</option>{categoryOptions.map(k=><option key={k} value={k}>{k}</option>)}
      </CustomSelect>
    </div>
    {error&&<p role="alert" className="text-xs text-rose-300">{error} <button type="button" className="underline" onClick={refresh}>Tekrar dene</button></p>}
    <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] overflow-hidden shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs text-left">
          <thead><tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">{['Ad','Kategori','Müşteri','Dolap / raf','Eklenme tarihi',''].map(v=><th key={v} className="py-3 px-3 font-semibold">{v}</th>)}</tr></thead>
          <tbody className="text-[#f3efe9]">{filtered.map(r=><tr key={r.id} className="border-b border-[#4a443f]/60 last:border-b-0 hover:bg-white/[0.03] transition-colors">
            <td className="py-3 px-3">{r.folder
              ?<button type="button" onClick={()=>navigate(r.id)} className="flex items-center gap-2 font-semibold text-white hover:text-[#b99881]"><Folder className="w-4 h-4 text-[#b99881] shrink-0"/>{r.name}</button>
              :<span className="flex items-center gap-2"><File className="w-4 h-4 text-[#a69f99] shrink-0"/>{r.name}</span>}</td>
            <td className="py-3 px-3 text-[#d6beae]">{r.category||'—'}</td>
            <td className="py-3 px-3 text-[#d6beae]">{r.customer||'—'}</td>
            <td className="py-3 px-3 text-[#d6beae]">{r.shelf||'—'}</td>
            <td className="py-3 px-3 text-[#a69f99] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
            <td className="py-3 px-3 text-right">{!r.folder&&<button type="button" aria-label={r.name+' dosyasını indir'} title="İndir" onClick={()=>void download(r)} className="p-1.5 rounded-full text-[#a69f99] hover:text-white hover:bg-white/10"><Download className="w-3.5 h-3.5"/></button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length&&!error&&<div className="py-14 text-center">
        <p className="text-sm font-semibold text-[#f3efe9]">{loading?'Arşiv yükleniyor…':query||category?'Bu filtreyle eşleşen kayıt yok.':'Bu klasör boş.'}</p>
        {!loading&&!query&&!category&&<p className="text-xs text-[#a69f99] mt-1">Klasör oluşturun veya dosya ekleyin.</p>}
      </div>}
    </div>
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

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {FileText,Plus,Search,RotateCw} from 'lucide-react'
import {userStore,type AppUser} from '@/services/userStore'
import type {Lead} from '@/types/lead'
import {draft,listContracts,openContract,statuses,type Contract,type ContractSummary,type Customer} from './contracts'
import {ContractDialog} from './ContractDialog'
import {CustomSelect} from '@/components/ui/CustomSelect'
import './contracts.css'

interface Workspace {
  rows:ContractSummary[]; error:string; loading:boolean; refresh:()=>void
  create:(customer?:Customer,visitorId?:string)=>void; view:(id:string)=>void
}
const Context=createContext<Workspace|null>(null)
export function ContractProvider({children,account,enabled}:{children:ReactNode;account:AppUser;enabled:boolean}) {
  const [rows,setRows]=useState<ContractSummary[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [dialog,setDialog]=useState<{doc:Contract;fromCard:boolean}|null>(null)
  const version=useRef(0),opening=useRef(0)
  const refresh=useCallback(async()=>{
    const v=++version.current
    if(!enabled){setRows([]);setLoading(false);return}
    setLoading(true);setError('')
    try{const list=await listContracts();if(v===version.current)setRows(list.sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||'')))}
    catch(e){if(v===version.current)setError((e as Error).message)}
    finally{if(v===version.current)setLoading(false)}
  },[enabled,account.id])
  useEffect(()=>{void refresh();window.addEventListener('focus',refresh);return ()=>{version.current++;opening.current++;window.removeEventListener('focus',refresh)}},[refresh])
  async function view(id:string){
    const v=++opening.current
    try{const doc=await openContract(id);if(v===opening.current)setDialog({doc,fromCard:account.department==='Satış'})}
    catch(e){if(v===opening.current)setError((e as Error).message)}
  }
  function create(customer?:Customer,visitorId?:string){
    opening.current++
    const doc=draft(customer,visitorId)
    if(account.department==='Satış'){if(!doc.lead_id)return;doc.advisor_id=account.id;doc.fields.advisor=account.fullName}
    setDialog({doc,fromCard:!!customer&&!visitorId})
  }
  return <Context.Provider value={enabled?{rows,error,loading,refresh,view,create}:null}>{children}
    {enabled&&dialog&&<ContractDialog key={dialog.doc.id} initial={dialog.doc} fromCard={dialog.fromCard}
      onSaved={refresh} onClose={()=>setDialog(null)}/>}
  </Context.Provider>
}
export function CustomerContractButton({lead,onOpen}:{lead:Lead;onOpen?:()=>void}) {
  const ctx=useContext(Context)
  if(!ctx)return null
  const record=ctx.rows.find(r=>r.lead_id===lead.id)
  return <button type="button" className="contract-card-button" disabled={ctx.loading} title={ctx.error||undefined}
    onClick={e=>{e.stopPropagation();if(ctx.error){ctx.refresh();return}onOpen?.();if(record)ctx.view(record.id);else ctx.create({id:lead.id,name:lead.fullName,phone:lead.phone})}}>
    <FileText size={13}/>{ctx.error?'Sözleşmeyi yenile':record?'Sözleşmeyi görüntüle':'Sözleşme ekle'}
  </button>
}
export function VisitorContractButton({id,name,phone}:{id:string;name:string;phone:string}) {
  const ctx=useContext(Context)
  const record=ctx?.rows.find(row=>row.visitor_id===id)
  const label=record?'Sözleşmeyi görüntüle':'Sözleşme ekle'
  return <button type="button" disabled={!ctx||ctx.loading||!!ctx.error} title={label} aria-label={label}
    onClick={()=>record?ctx?.view(record.id):ctx?.create({id,name,phone},id)}><FileText size={15}/></button>
}
export function useContractCount(){return useContext(Context)?.rows.length??null}
export function ContractsPage({embedded=false}:{embedded?:boolean}){
  const ctx=useContext(Context),[query,setQuery]=useState(''),[status,setStatus]=useState('')
  if(!ctx)return <p>Bu sayfa için sözleşme yetkisi gerekiyor.</p>
  const q=query.trim().toLocaleLowerCase('tr'),rows=ctx.rows.filter(r=>(!status||r.status===status)&&[r.name,r.title,r.number].some(v=>v?.toLocaleLowerCase('tr').includes(q)))
  const newButton=<button type="button" className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b99881] hover:bg-[#c9a891] text-xs font-semibold text-[#1c1a18] transition-colors" onClick={()=>ctx.create()}><Plus className="w-3.5 h-3.5"/>Yeni sözleşme</button>
  return <section className="contracts-page space-y-5">
    {!embedded&&<div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2.5"><FileText className="w-5 h-5 text-[#b99881]"/><h2 className="text-2xl font-bold text-white tracking-wide">Sözleşmeler</h2></div>
      {newButton}
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      {embedded&&<div className="order-last ml-auto">{newButton}</div>}
      <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
        <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2"/>
        <input aria-label="Sözleşme ara" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Müşteri veya sözleşme numarası ara"
          className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"/>
      </div>
      <CustomSelect value={status} onChange={e=>setStatus(e.target.value)} title="Durum"
        className="px-3.5 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white">
        <option value="">Tüm durumlar</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </CustomSelect>
      <button type="button" aria-label="Sözleşmeleri yenile" title="Yenile" onClick={ctx.refresh}
        className="p-2 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white transition-colors"><RotateCw className={`w-3.5 h-3.5 ${ctx.loading?'animate-spin':''}`}/></button>
    </div>
    {ctx.error&&<p className="text-xs text-rose-300" role="alert">{ctx.error}</p>}
    <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] overflow-hidden shadow-sm">
      {ctx.loading&&!ctx.rows.length?<p role="status" className="py-14 text-center text-sm text-[#a69f99]">Sözleşmeler yükleniyor…</p>
      :rows.length?<div className="w-full overflow-x-auto"><table className="w-full min-w-[560px] text-xs text-left">
        <thead><tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">{['Müşteri','Sözleşme no','Durum','Güncelleme'].map(v=><th key={v} className="py-3 px-3 font-semibold">{v}</th>)}</tr></thead>
        <tbody className="text-[#f3efe9]">{rows.map(row=><tr key={row.id} onClick={()=>ctx.view(row.id)} className="border-b border-[#4a443f]/60 last:border-b-0 hover:bg-white/[0.03] cursor-pointer transition-colors">
          <td className="py-3 px-3"><div className="flex items-center gap-2.5 min-w-0"><FileText className="w-4 h-4 text-[#b99881] shrink-0"/><div className="min-w-0"><div className="font-semibold text-white truncate">{row.name}</div><div className="text-[11px] text-[#a69f99] truncate">{row.title}</div></div></div></td>
          <td className="py-3 px-3 font-mono text-[#d6beae] whitespace-nowrap">{row.number||'—'}</td>
          <td className="py-3 px-3"><span className="px-2.5 py-1 rounded-full bg-[#34302d] border border-[#4a443f] text-[11px] font-semibold text-[#d6beae] whitespace-nowrap">{statuses[row.status]}</span></td>
          <td className="py-3 px-3 text-[#a69f99] whitespace-nowrap">{row.updated_at?new Date(row.updated_at).toLocaleDateString('tr-TR'):'—'}</td>
        </tr>)}</tbody>
      </table></div>
      :!ctx.error&&<div className="py-14 text-center"><p className="text-sm font-semibold text-[#f3efe9]">{query||status?'Bu aramada sözleşme bulunamadı.':'Henüz sözleşme kaydı yok.'}</p>{!query&&!status&&<p className="text-xs text-[#a69f99] mt-1">"Yeni sözleşme" ile ilk kaydı oluşturun.</p>}</div>}
    </div>
  </section>
}

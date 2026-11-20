import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {FileText,Plus,Search,RotateCw} from 'lucide-react'
import {userStore,type AppUser} from '@/services/userStore'
import type {Lead} from '@/types/lead'
import {draft,listContracts,openContract,statuses,type Contract,type ContractSummary,type Customer} from './contracts'
import {ContractDialog} from './ContractDialog'
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
export function ContractsPage(){
  const ctx=useContext(Context),[query,setQuery]=useState(''),[status,setStatus]=useState('')
  if(!ctx)return <p>Bu sayfa için sözleşme yetkisi gerekiyor.</p>
  const q=query.trim().toLocaleLowerCase('tr'),rows=ctx.rows.filter(r=>(!status||r.status===status)&&[r.name,r.title,r.number].some(v=>v?.toLocaleLowerCase('tr').includes(q)))
  return <section className="contracts-page">
    <header><h2><FileText size={22}/> Sözleşmeler</h2><button className="contract-primary" onClick={()=>ctx.create()}><Plus size={16}/> Yeni sözleşme</button></header>
    <div className="contract-tools"><label><Search size={16}/><input aria-label="Sözleşme ara" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Müşteri veya sözleşme numarası ara"/></label>
    <select aria-label="Durum" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tüm durumlar</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <button aria-label="Sözleşmeleri yenile" onClick={ctx.refresh}><RotateCw size={16}/></button></div>
    {ctx.error&&<p className="contract-error" role="alert">{ctx.error}</p>}
    {ctx.loading&&!ctx.rows.length?<p role="status">Sözleşmeler yükleniyor…</p>:rows.length?<div className="contract-list">{rows.map(row=><button key={row.id} onClick={()=>ctx.view(row.id)}>
      <FileText size={18}/><span><strong>{row.name}</strong><small>{row.title}</small></span><span>{row.number||'—'}</span><span>{statuses[row.status]}</span></button>)}</div>:!ctx.error&&<p className="contract-empty">{query||status?'Bu aramada sözleşme bulunamadı.':'Henüz sözleşme kaydı yok.'}</p>}
  </section>
}

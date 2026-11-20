import {useEffect, useMemo, useSyncExternalStore, type SetStateAction} from 'react'
import {userStore} from './userStore'

type Values=Record<string,unknown>
type Snapshot={values:Values;ready:boolean;saving:boolean;error:string;conflict:boolean}
const spaces=new Map<string,PersonalTools>()
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

export class PersonalTools {
  private base:Values={}
  private pending:Values={}
  private working=false
  private listeners=new Set<()=>void>()
  private state:Snapshot={values:{},ready:false,saving:false,error:'',conflict:false}
  constructor(readonly owner:string){}
  snapshot=()=>this.state
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn)}}
  private emit(partial:Partial<Snapshot>={}){
    this.state={...this.state,...partial,values:{...this.base,...this.pending}}
    this.listeners.forEach(fn=>fn())
  }
  private async request(name:string,args:Values){
    const client=userStore.getServerClient()
    if(!client||userStore.getCurrentUser()?.id!==this.owner)throw Error('Hesap oturumu değişti.')
    const res=await client.rpc(name,{p_owner:this.owner,...args}).abortSignal(AbortSignal.timeout(20000))
    if(res.error)throw Error('Kişisel araçlar sunucuyla eşitlenemedi.')
    return res.data
  }
  private async read(){return (await this.request('crm_tools_read',{})) as Values}
  refresh=async()=>{
    if(this.working||this.state.conflict)return
    if(Object.keys(this.pending).length){await this.flush();return}
    this.working=true
    try{
      const remote=await this.read()
      // Edits made while reading still compare against the version the user saw.
      const previous=this.base
      this.base={...remote}
      for(const key of Object.keys(this.pending)){
        if(key in previous)this.base[key]=previous[key]
        else delete this.base[key]
      }
      this.emit({ready:true,error:''})
      // Old notes with a recorded owner can be recovered on this device.
      const marker='portfoy_private_notes_migrated_'+this.owner
      if(!localStorage.getItem(marker)){
        const old=JSON.parse(localStorage.getItem('demirturk_notepad_notes_v1')||'[]')
        const notes=Array.isArray(this.base.notes)?this.base.notes:[]
        const owned=Array.isArray(old)?old.filter(n=>n?.ownerId===this.owner&&!notes.some(saved=>saved.id===n.id)):[]
        if(owned.length && !('notes' in this.pending)){
          this.pending.notes=[...notes,...owned.map(n=>({...n,shareScope:'PRIVATE',sharedUserIds:[],sharedDepartments:[]}))]
          this.emit()
        }else if(!owned.length)localStorage.setItem(marker,'1')
      }
    }catch(e){this.emit({error:(e as Error).message})}
    finally{this.working=false}
    if(Object.keys(this.pending).length)await this.flush()
  }
  set(key:string,value:unknown){
    if(!this.state.ready||this.owner!==userStore.getCurrentUser()?.id)return
    this.pending[key]=value;this.emit()
    // Collect changes from the same user action in one transaction.
    queueMicrotask(()=>void this.flush())
  }
  private async flush(){
    if(this.working||this.state.conflict||!Object.keys(this.pending).length)return
    this.working=true;this.emit({saving:true,error:''})
    try{
      while(Object.keys(this.pending).length){
        const patch={...this.pending}
        const expected=Object.fromEntries(Object.keys(patch).filter(k=>k in this.base).map(k=>[k,this.base[k]]))
        if(await this.request('crm_tools_save',{p_patch:patch,p_base:expected})!==true){
          this.emit({conflict:true,error:'Aynı alan başka bir pencerede değişti. Hangi sürümü kullanacağınızı seçin.'});break
        }
        Object.assign(this.base,patch)
        for(const k of Object.keys(patch))if(equal(this.pending[k],patch[k]))delete this.pending[k]
        if('notes' in patch)localStorage.setItem('portfoy_private_notes_migrated_'+this.owner,'1')
      }
    }catch(e){this.emit({error:(e as Error).message})}
    finally{this.working=false;this.emit({saving:false})}
  }
  resolve=async(keep:boolean)=>{
    if(this.working)return
    this.working=true
    try{this.base=await this.read();if(!keep)this.pending={};this.emit({conflict:false,error:''})}
    catch(e){this.emit({error:(e as Error).message});return}
    finally{this.working=false}
    await this.flush()
  }
}

export function usePersonalTools(owner:string,active:boolean){
  const space=useMemo(()=>{let s=spaces.get(owner);if(!s){s=new PersonalTools(owner);spaces.set(owner,s)}return s},[owner])
  const state=useSyncExternalStore(space.subscribe,space.snapshot)
  useEffect(()=>{if(!active||!owner)return;void space.refresh();window.addEventListener('focus',space.refresh);window.addEventListener('online',space.refresh)
    return ()=>{window.removeEventListener('focus',space.refresh);window.removeEventListener('online',space.refresh)}},[space,active,owner])
  function field<T>(key:string,fallback:T|(()=>T)):[T,(v:SetStateAction<T>)=>void] {
    const get=():T=>key in space.snapshot().values?space.snapshot().values[key] as T:typeof fallback==='function'?(fallback as ()=>T)():fallback
    return [get(),value=>space.set(key,typeof value==='function'?(value as (previous:T)=>T)(get()):value)]
  }
  return {state,field,retry:space.refresh,resolve:space.resolve}
}

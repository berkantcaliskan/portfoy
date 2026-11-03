import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as core from '../supabase/functions/_shared/meta-core.ts'
import {MetaStageQueue} from '../src/services/metaStageQueue.ts'

function setup(options:any={}) {
  const source=fs.readFileSync(new URL('../src/services/metaStore.ts',import.meta.url),'utf8')
    .replaceAll('import.meta.env',"({ VITE_SUPABASE_URL: 'https://isolated.invalid' })")
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const calls:any[]=[]
  let leads:any[]=options.leads||[]
  const leadStore:any={getAllRaw:()=>leads,getById:(id:string)=>leads.find(l=>l.id===id),
    updateMetaCapiStatus:(id:string,status:any)=>{leads=leads.map(l=>l.id===id?{...l,metaCapiStatus:status}:l)},
    ackMetaStage:()=>{},acceptMetaServerLead:()=>{}}
  const supabase={auth:{getSession:async()=>({data:{session:{}}})},functions:{invoke:async(_name:string,{body}:any)=>{
    calls.push(body)
    if(options.invoke) return options.invoke(body)
    return {data:{datasetId:'123',events:options.events||[],autoSyncStages:body.autoSyncStages||false},error:null}
  }}}
  const exported:any={}
  vm.runInNewContext(js,{exports:exported,require:(id:string)=>{
    if(id==='./leadStore')return {leadStore}
    if(id==='./supabaseClient')return {supabase,SUPABASE_URL:'https://isolated.invalid'}
    if(id==='./dbMapper')return {rowToLead:(r:any)=>r}
    if(id==='./metaStageQueue')return {MetaStageQueue}
    if(id.includes('meta-core'))return core
    throw Error('Unexpected import: '+id)
  },localStorage:{removeItem:()=>{}},Response,crypto,console})
  return {store:exported.metaStore,exported,calls,getLead:()=>leads[0]}
}
const lead={id:'isolated',stage:'QUALIFIED',isQualified:true,metaRevision:3,metaLeadId:'123',fullName:'İzole Test',phone:'',metaCapiStatus:{status:'SENT',lastEventName:'QualifiedLead',label:'Nitelikli',revision:3}}
test('Demo otomatik ayarı frontendden açılamaz; hiçbir istek göndermez',async()=>{
  const s=setup({leads:[lead]});await assert.rejects(s.store.setAutoSyncStages(true))
  assert.equal(s.calls.length,0)
})
test('Otomatik ayarı kapatma yalnızca configure/status çağırır',async()=>{
  const s=setup({leads:[lead]});await s.store.setAutoSyncStages(false)
  assert.deepEqual(s.calls.map(c=>c.action),['configure','status'])
})
test('Frontend aşama kaydı yalnızca CRM stage işlemi çağırır',async()=>{
  const s=setup({leads:[lead],invoke:async()=>({data:{revision:4,updatedAt:new Date().toISOString()},error:null})})
  s.store.persistStageChange(lead)
  await new Promise(r=>setImmediate(r))
  assert.deepEqual(s.calls.map(c=>c.action),['stage'])
})
test('Toplu geçmiş aktarımı açık müşteri seçimi olmadan reddedilir',async()=>{
  const s=setup({leads:[lead]});await assert.rejects(s.store.syncLeadsToMetaManual());assert.equal(s.calls.length,0)
})
test('Frontend bağlantı testi network hatasını başarıya çeviremez',async()=>{
  const s=setup({invoke:async()=>({data:null,error:Error('isolated-failure')})})
  assert.equal((await s.store.testConnection()).success,false);assert.equal(s.store.getConfig().isConnected,false)
})
test('Daha önce gönderilmiş aynı olay adı yeni revisionı gizleyemez',()=>{
  const s=setup();assert.equal(s.exported.isLeadPendingMetaSync(lead),false)
  assert.equal(s.exported.isLeadPendingMetaSync({...lead,metaRevision:4}),true)
})
test('Sunucu revisionı olmayan yerel kayıt gönderilebilir gösterilmez',()=>{
  const s=setup();assert.equal(s.exported.isLeadPendingMetaSync({...lead,metaRevision:undefined}),false)
})
test('Test Events başarısı canlı lead teslim durumunu değiştirmez',async()=>{
  const failed={...lead,metaCapiStatus:{...lead.metaCapiStatus,status:'FAILED'}}
  const s=setup({leads:[failed],events:[{id:'test-event',lead_id:lead.id,event_name:'QualifiedLead',revision:3,state:'sent',test_mode:true}]})
  await s.store.refreshStatus();assert.equal(s.getLead().metaCapiStatus.status,'FAILED')
})
test('Workerın güncel canlı sonucu yerel teslim görünümüne yansır',async()=>{
  const s=setup({leads:[lead],events:[{id:'live-event',lead_id:lead.id,event_name:'QualifiedLead',revision:4,state:'retry',test_mode:false}]})
  await s.store.refreshStatus();assert.equal(s.getLead().metaCapiStatus.status,'QUEUED');assert.equal(s.getLead().metaCapiStatus.revision,4)
})

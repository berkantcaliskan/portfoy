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
  const sessionSources:string[]=[],functionSources:string[]=[],headers:any[]=[]
  let refreshCount=0
  let leads:any[]=options.leads||[]
  const leadStore:any={getAllRaw:()=>leads,getById:(id:string)=>leads.find(l=>l.id===id),
    updateMetaCapiStatus:(id:string,status:any)=>{leads=leads.map(l=>l.id===id?{...l,metaCapiStatus:status}:l)},
    ackMetaStage:()=>{},acceptMetaServerLead:(lead:any)=>{leads=[...leads.filter(l=>l.id!==lead.id),lead]}}
  const invoke=async(source:string,_name:string,{body}:any)=>{
    functionSources.push(source)
    calls.push(body)
    if(options.invoke) return options.invoke(body)
    return {data:{datasetId:'123',events:options.events||[],autoSyncStages:body.autoSyncStages||false},error:null}
  }
  const makeClient=(source:string,session:any)=>({auth:{getSession:async()=>{sessionSources.push(source);return {data:{session}}},refreshSession:async()=>{refreshCount++;if(options.refresh)return options.refresh();return {data:{session:{...session,access_token:'refreshed-token'}},error:null}}},functions:{invoke:(name:string,args:any)=>{headers.push(args.headers);return invoke(source,name,args)}}})
  const supabase=makeClient('legacy',options.legacySession===false?null:{user:{id:'legacy-auth'}})
  const centralClient=options.noCentralClient?null:makeClient('central',options.centralSession===false?null:{user:{id:options.sessionUser||'central-auth'},access_token:'main-session-token'})
  const exported:any={}
  vm.runInNewContext(js,{exports:exported,require:(id:string)=>{
    if(id==='./leadStore')return {leadStore}
    if(id==='./supabaseClient')return {supabase,SUPABASE_URL:'https://isolated.invalid'}
    if(id==='./crmRuntime')return {isCentralCrm:()=>!!options.central}
    if(id==='./userStore')return {userStore:{centralAuthEnabled:!!options.mainCentral,getServerClient:()=>centralClient,getCurrentUser:()=>options.noUser?null:{authUserId:'central-auth'}}}
    if(id==='./dbMapper')return {rowToLead:(r:any)=>r}
    if(id==='./metaStageQueue')return {MetaStageQueue}
    if(id.includes('meta-core'))return core
    throw Error('Unexpected import: '+id)
  },localStorage:{removeItem:()=>{}},Response,crypto,console})
  return {store:exported.metaStore,exported,calls,sessionSources,functionSources,headers,getRefreshCount:()=>refreshCount,getLead:()=>leads[0]}
}
test('Meta işlemi merkezi CRM oturumunu kullanır; eski ayrı oturum aranmaz',async()=>{
 const s=setup({central:true,legacySession:false})
 await s.exported.invokeMeta({action:'status'})
 assert.deepEqual(s.sessionSources,['central']);assert.deepEqual(s.functionSources,['central'])
 assert.equal(s.headers[0].Authorization,'Bearer main-session-token')
})

test('Gönderim listesi yerel önbellek yerine sunucunun bütün sayfalarından gelir',async()=>{
 const s=setup({central:true,invoke:async(body:any)=>({data:{records:[{id:body.cursor?'second':'first'}],cursor:body.cursor?null:'next'},error:null})})
 const rows=await s.store.getServerPendingResults()
 assert.deepEqual(Array.from(rows,(r:any)=>r.id),['first','second'])
 assert.equal(s.calls.every(c=>c.action==='pending'),true)
})
test('Sunucudan doğrulanan 30dan fazla sonuç açık tıklamayla aynı revision ve kaynakla gönderilir',async()=>{
 const rows=Array.from({length:35},(_,i)=>({id:'lead-'+i,fullName:'İzole',stage:'QUALIFIED',revision:3,eventName:'QualifiedLead',retry:false,sources:[{id:String(100+i),label:'Form'}]}))
 const s=setup({central:true,invoke:async(body:any)=>({data:{event:{id:body.leadId,lead_id:body.leadId,event_name:body.eventName,revision:body.revision,state:'sent',test_mode:false,events_received:1}},error:null})})
 const result=await s.store.sendServerPendingResults(rows)
 assert.equal(result.sent,35);assert.equal(result.failed,0)
 assert.equal(s.calls.length,35);assert.equal(s.calls.every(c=>c.action==='enqueue'&&c.revision===3&&c.leadgenId),true)
})
test('Kısmi Meta hatası başarı sayılmaz ve seçilmemiş başvuru tahmin edilmez',async()=>{
 const s=setup({central:true,invoke:async()=>({data:{event:{state:'rejected',test_mode:false,events_received:0}},error:null})})
 const row={id:'lead',fullName:'İzole',stage:'QUALIFIED',revision:1,eventName:'QualifiedLead',sources:[{id:'111'},{id:'222'}]}
 const result=await s.store.sendServerPendingResults([row])
 assert.equal(result.sent,0);assert.equal(result.failed,1);assert.equal(s.calls.length,0)
})

test('Ana CRM oturumu etkinse eski çalışma modu ayrı Meta oturumuna düşüremez',async()=>{
 const s=setup({mainCentral:true,legacySession:false})
 await s.exported.invokeMeta({action:'connection'})
 assert.deepEqual(s.functionSources,['central'])
})

test('Yetkisiz veri alımı aynı hesap yenilenerek yalnızca bir kez tekrar edilir',async()=>{
 let attempts=0
 const s=setup({central:true,invoke:async()=>++attempts===1?{error:{context:new Response('{}',{status:401})}}:{data:{forms:[]},error:null}})
 await s.exported.invokeMeta({action:'pull',from:'2026-11-19',to:'2026-11-20'})
 assert.equal(attempts,2);assert.equal(s.getRefreshCount(),1)
 assert.equal(s.headers[1].Authorization,'Bearer refreshed-token')
 assert.deepEqual(s.calls[0],s.calls[1])
})

test('Yenileme başka hesaba aitse veri alımı o hesapla sürdürülmez',async()=>{
 const s=setup({central:true,invoke:async()=>({error:{context:new Response('{}',{status:401})}}),refresh:async()=>({data:{session:{user:{id:'other-auth'},access_token:'other-token'}},error:null})})
 await assert.rejects(s.exported.invokeMeta({action:'pull'}),/tekrar giriş/)
 assert.equal(s.calls.length,1)
})

test('İkinci yetkisiz cevap döngü oluşturmaz; gönderim aynı kimliklerle bir kez yenilenir',async()=>{
 for(const action of ['pull','enqueue','stage','test','configure']){
  const s=setup({central:true,invoke:async()=>({error:{context:new Response('{}',{status:401})}})})
  await assert.rejects(s.exported.invokeMeta({action}))
  assert.equal(s.calls.length,2)
  assert.equal(s.getRefreshCount(),1)
  assert.deepEqual(s.calls[0],s.calls[1])
 }
})
test('Merkezi Meta oturumu eksikse veya başka hesaba aitse eski oturuma düşmez',async()=>{
 for(const option of [{noCentralClient:true},{centralSession:false},{sessionUser:'other-account'},{noUser:true}]) {
  const s=setup({central:true,...option})
  await assert.rejects(s.exported.invokeMeta({action:'status'}))
  assert.equal(s.functionSources.length,0);assert.equal(s.sessionSources.includes('legacy'),false)
 }
})
test('Meta yanıtı gelmeden hesap kapanırsa sonuç yeni oturuma taşınmaz',async()=>{
 const options:any={central:true,invoke:async()=>{options.noUser=true;return {data:{events:[]},error:null}}}
 const s=setup(options)
 await assert.rejects(s.exported.invokeMeta({action:'status'}),/oturum değişti/)
})
const lead={id:'isolated',stage:'QUALIFIED',isQualified:true,metaRevision:3,metaLeadId:'123',fullName:'İzole Test',phone:'',metaCapiStatus:{status:'SENT',lastEventName:'QualifiedLead',label:'Nitelikli',revision:3}}
test('Alım ilerlemesi yalnızca dönen sayfa ve işlenen müşterileri bildirir',async()=>{
 const messages:string[]=[]
 const s=setup({invoke:async(body:any)=>({data:body.formId?{leads:[{...lead,id:'returned'}],cursor:null}:{forms:[{id:'1'}]},error:null})})
 await s.store.fetchLeadsFromMeta(new Date('2026-11-01'),new Date('2026-11-03'),(message:string)=>messages.push(message))
 assert.ok(messages.some(m=>m.includes('0 müşteri')))
 assert.ok(messages.at(-1)?.includes('1 sayfa tamamlandı, 1 müşteri'))
 assert.equal(messages.some(m=>m.includes('tamamlandı!')),false)
})
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
test('Aynı müşterinin aynı sayfada gelen ikinci formu UI geçmişinden düşmez',async()=>{
  const base={id:'same-customer',stage:'NEW',source:'META_ADS',formName:'Form A',isQualified:false}
  const a={...base,inquiries:[{formName:'Form A',source:'META_ADS',metaLeadgenId:'111'}]}
  const b={...base,inquiries:[...a.inquiries,{formName:'Form B',source:'META_ADS',metaLeadgenId:'222'}]}
  const s=setup({invoke:async(body:any)=>({data:body.formId?{leads:[a,b],cursor:null}:{forms:[{id:'1'}]},error:null})})
  const result=await s.store.fetchLeadsFromMeta(new Date('2026-11-01'),new Date('2026-11-03'))
  assert.equal(result.newCount,1);assert.equal(s.getLead().inquiries.length,2)
  assert.deepEqual(Array.from(s.store.getForms(),(f:any)=>f.name).sort(),['Form A','Form B'])
})
test('Formların ve PM listesinin tüm cursor sayfaları okunur',async()=>{
  const row=(id:string)=>({id,stage:'NEW',source:'META_ADS',formName:'Form',inquiries:[]})
  const s=setup({invoke:async(body:any)=>({data:!body.formId
    ? body.cursor?{forms:[{id:'2'}],cursor:null}:{forms:[{id:'1'}],cursor:'form-page-2'}
    : body.formId==='1'?body.cursor?{leads:[row('b')],cursor:null}:{leads:[row('a')],cursor:'lead-page-2'}
    : {leads:[row('c')],cursor:null},error:null})})
  const result=await s.store.fetchLeadsFromMeta(new Date('2026-11-01'),new Date('2026-11-03'))
  assert.equal(result.newCount,3);assert.equal(result.error,undefined);assert.equal(s.calls.length,5)
})
test('Meta cursor döngüsü sessizce sonsuz sürmez',async()=>{
  const s=setup({invoke:async(body:any)=>({data:body.formId?{leads:[],cursor:'same'}:{forms:[{id:'1'}]},error:null})})
  const result=await s.store.fetchLeadsFromMeta(new Date('2026-11-01'),new Date('2026-11-03'))
  assert.ok(result.error.includes('döngü'));assert.equal(s.calls.length,3)
})
test('Kısmi alımdan sonraki API hatası başarı sayılarının arkasında gizlenmez',async()=>{
  const s=setup({invoke:async(body:any)=>{
    if(!body.formId)return {data:{forms:[{id:'1'}]},error:null}
    if(body.cursor)return {data:{error:'İzole ikinci sayfa hatası'},error:null}
    return {data:{leads:[{id:'first',stage:'NEW',source:'META_ADS',inquiries:[]}],cursor:'next'},error:null}
  }})
  const result=await s.store.fetchLeadsFromMeta(new Date('2026-11-01'),new Date('2026-11-03'))
  assert.equal(result.newCount,1);assert.ok(result.error.includes('ikinci sayfa'));assert.equal(s.getLead().id,'first')
})

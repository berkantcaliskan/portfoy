import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCapiHandler} from '../supabase/functions/_shared/meta-capi-handler.ts'

function setup(options:any={}) {
  const calls:any[]=[]
  const settings={enabled:false,security_ready:true,auto_sync:false,...options.settings}
  const envValues:any={SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-server-key',
    META_WORKER_SECRET:'isolated-worker-key',META_DATASET_ID:'123',META_CAPI_ACCESS_TOKEN:'isolated-capi-key',META_GRAPH_VERSION:'v99.0',META_TEST_EVENT_CODE:'ISOLATED',META_ALLOWED_ORIGINS:'https://crm.invalid',...options.env}
  let table=''
  let outcome:any={id:'event-id',lead_id:'lead',revision:1,state:'pending',event_name:'QualifiedLead'}
  const query:any={select(){return this},eq(){return this},order(){return this},limit(){return this},update(){return this},
    async single(){return {data:table==='meta_settings'?settings:outcome,error:null}},
    async maybeSingle(){return {data:options.member===undefined?{can_send:true,is_admin:true}:options.member,error:null}}}
  const client:any={auth:{async getUser(token:string){calls.push({auth:token});return {data:{user:token==='valid-user'?{id:'user-id'}:null},error:null}}},
    from(name:string){table=name;calls.push({table});return query},
    async rpc(name:string,args:any){calls.push({rpc:name,args});
      if(name==='meta_enqueue_checked') return {data:'event-id',error:null}
      if(name==='meta_claim') return {data:options.jobs||[],error:null}
      if(name==='meta_set_stage') return {data:{meta_revision:2,updated_at:new Date().toISOString()},error:null}
      if(name==='meta_finish') {outcome={...outcome,state:args.p_result.state,events_received:args.p_result.received};return {data:null,error:null}}
      return {data:null,error:null}}}
  let fetchCount=0
  const handler=createCapiHandler({env:name=>envValues[name]||'',createClient:()=>client,
    fetcher:async(...args)=>{fetchCount++;calls.push({fetch:args});return options.fetcher?options.fetcher(...args):Response.json({id:'123'})}})
  const req=(body:any,token='',origin='')=>new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify(body),headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(origin?{Origin:origin}:{})}})
  return {handler,req,calls,fetchCount:()=>fetchCount}
}
test('CAPI anonim çağrıyı reddeder ve Meta isteği yapmaz',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'enqueue'}))).status,401);assert.equal(s.fetchCount(),0)})
test('Geçersiz kullanıcı JWT reddedilir',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'enqueue'},'invalid'))).status,401)})
test('Üyeliği olmayan kullanıcı reddedilir',async()=>{const s=setup({member:null});assert.equal((await s.handler(s.req({action:'enqueue'},'valid-user'))).status,403)})
test('Gönderim yetkisi olmayan kullanıcı reddedilir',async()=>{const s=setup({member:{can_send:false,is_admin:false}});assert.equal((await s.handler(s.req({action:'enqueue'},'valid-user'))).status,403)})
test('CORS izin listesi dışındaki origin reddedilir',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'connection'},'valid-user','https://other.invalid'))).status,403)})
test('Bozuk istek şekli 400 döndürür',async()=>{const s=setup();assert.equal((await s.handler(s.req(null))).status,400);assert.equal((await s.handler(s.req([]))).status,400)})
test('Demo yetkili workerı da durdurur; arka planda claim veya Meta çağrısı yoktur',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'process'},'isolated-worker-key'))).status,409);assert.equal(s.calls.some(x=>x.rpc==='meta_claim'),false);assert.equal(s.fetchCount(),0)})
test('Yanlış worker sırrı Auth kontrolünü atlayamaz',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'process'},'wrong-worker'))).status,401);assert.equal(s.calls.some(x=>x.rpc==='meta_claim'),false)})
test('Normal kullanıcının background process çağrısı da gönderim yapmaz',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'process'},'valid-user'))).status,409);assert.equal(s.fetchCount(),0)})
test('Yönetici ayarı bile otomatik gönderimi açamaz',async()=>{
  const s=setup({settings:{enabled:true}})
  assert.equal((await s.handler(s.req({action:'configure',autoSyncStages:true},'valid-user'))).status,409)
  assert.equal(s.calls.some(x=>x.rpc==='meta_claim'),false)
})
test('CRM aşaması kaydedilirken Meta isteği veya outbox enqueue oluşmaz',async()=>{
  const s=setup({settings:{enabled:true},env:{META_GRAPH_VERSION:'',META_CAPI_ACCESS_TOKEN:''}})
  const response=await s.handler(s.req({action:'stage',leadId:'lead',revision:1,stage:'QUALIFIED',qualified:true},'valid-user'))
  assert.equal(response.status,200);assert.equal((await response.json()).revision,2)
  assert.equal(s.fetchCount(),0);assert.equal(s.calls.some(x=>x.rpc==='meta_enqueue_checked'||x.rpc==='meta_claim'),false)
})
test('Üretim kapalıyken canlı enqueue claim yapamaz',async()=>{const s=setup();assert.equal((await s.handler(s.req({action:'enqueue',leadId:'lead',revision:1,eventName:'QualifiedLead'},'valid-user'))).status,409);assert.equal(s.calls.some(x=>x.rpc==='meta_claim'),false)})
test('Test olayında sunucu test kodu zorunludur',async()=>{const s=setup({env:{META_TEST_EVENT_CODE:''}});assert.equal((await s.handler(s.req({action:'test',leadId:'lead',revision:1,eventName:'QualifiedLead'},'valid-user'))).status,409)})
test('Bağlantı testi yönetici gerektirir',async()=>{const s=setup({member:{can_send:true,is_admin:false}});assert.equal((await s.handler(s.req({action:'connection'},'valid-user'))).status,403);assert.equal(s.fetchCount(),0)})
test('Eksik dataset yapılandırması gönderimi engeller',async()=>{const s=setup({settings:{enabled:true},env:{META_DATASET_ID:''}});assert.equal((await s.handler(s.req({action:'enqueue',leadId:'lead',revision:1,eventName:'QualifiedLead'},'valid-user'))).status,503)})
test('Eski veya eksik revision ile manual enqueue reddedilir',async()=>{const s=setup({settings:{enabled:true}});assert.equal((await s.handler(s.req({action:'enqueue',leadId:'lead',eventName:'QualifiedLead'},'valid-user'))).status,400);assert.equal(s.calls.some(x=>x.rpc==='meta_enqueue_checked'),false)})
test('Acil otomatik gönderim kapatma eksik Graph ayarından bağımsızdır',async()=>{
  const s=setup({settings:{enabled:false,security_ready:false},env:{META_GRAPH_VERSION:'',META_DATASET_ID:''}})
  assert.equal((await s.handler(s.req({action:'configure',autoSyncStages:false},'valid-user'))).status,200)
  assert.equal(s.fetchCount(),0)
})
const job={id:'event-id',lead_id:'lead',lease_id:'lease-id',revision:1,event_name:'QualifiedLead',attempt:1,test_mode:false,
  occurred_at:new Date().toISOString(),snapshot:{id:'lead',stage:'QUALIFIED',is_qualified:true,meta_lead_id:'123',full_name:'İzole Test',phone:'05321234567'}}
const enqueue={action:'enqueue',leadId:'lead',revision:1,eventName:'QualifiedLead'}
test('Gerçek handler Meta sıfır olay kabul ettiğinde SENT yazamaz',async()=>{
  const s=setup({settings:{enabled:true},jobs:[job],fetcher:async()=>Response.json({events_received:0})})
  const response=await s.handler(s.req(enqueue,'valid-user'));assert.equal(response.status,200)
  assert.equal((await response.json()).event.state,'rejected')
})
test('Gerçek handler bir olayın API kabulünü kaydeder',async()=>{
  const s=setup({settings:{enabled:true},jobs:[job],fetcher:async()=>Response.json({events_received:1,fbtrace_id:'isolated-trace'})})
  const response=await s.handler(s.req(enqueue,'valid-user'));assert.equal((await response.json()).event.state,'sent')
  assert.equal(s.calls.find(c=>c.rpc==='meta_enqueue_checked').args.p_revision,1)
})
test('Gerçek handler ağ timeoutunu retry olarak kaydeder',async()=>{
  const s=setup({settings:{enabled:true},jobs:[job],fetcher:async()=>{throw Error('isolated-timeout')}})
  const response=await s.handler(s.req(enqueue,'valid-user'));assert.equal((await response.json()).event.state,'retry')
  assert.equal(s.calls.find(c=>c.rpc==='meta_finish').args.p_result.retrySeconds,30)
})
test('Test olayı üretim kapalıyken yalnızca server test koduyla iletilir',async()=>{
  const s=setup({jobs:[{...job,test_mode:true}],fetcher:async()=>Response.json({events_received:1})})
  const response=await s.handler(s.req({...enqueue,action:'test'},'valid-user'));assert.equal(response.status,200)
  const payload=JSON.parse(s.calls.find(c=>c.fetch).fetch[1].body)
  assert.equal(payload.test_event_code,'ISOLATED');assert.equal(payload.data[0].event_id,'event-id')
})

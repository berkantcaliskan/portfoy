import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCapiHandler} from '../supabase/functions/_shared/meta-capi-handler.ts'

test('Sistem kullanıcısı bağlantısı hedef sayfayı okur; sır yanıt içinde bulunmaz',async()=>{
 const urls:string[]=[]
 const s=setup({env:{META_PAGE_ID:'900',META_SYSTEM_USER_TOKEN:'isolated-system',META_PAGE_ACCESS_TOKEN:'expired-page'},fetcher:async(url:any)=>{
  const path=String(url);urls.push(path)
  if(path.includes('debug_token')) return Response.json({data:{is_valid:true,type:'SYSTEM_USER',expires_at:0}})
  if(path.includes('fields=id,access_token')) return Response.json({id:'900',access_token:'derived-page'})
  if(path.includes('leadgen_forms')) return Response.json({data:[{id:'901'}]})
  if(path.includes('/leads')) return Response.json({data:[]})
  return Response.json({id:path.includes('/900?')?'900':'123'})
 }})
 const response=await s.handler(s.req({action:'connection'},'valid-user'))
 assert.equal(response.status,200)
 const body=await response.json()
 assert.equal(body.pageAccessMode,'SYSTEM_USER');assert.equal(body.credentialInfo.expiresAt,0)
 assert.equal(body.leadReadVerified,true);assert.equal(body.eventSubmissionVerified,false)
 assert.equal(urls.some(u=>u.includes('/me?')),false)
 assert.equal(JSON.stringify(body).includes('isolated-system'),false)
 assert.equal(JSON.stringify(body).includes('derived-page'),false)
 for(const c of s.calls.filter(c=>c.fetch && (String(c.fetch[0]).includes('leadgen_forms')||String(c.fetch[0]).includes('/leads')))){
  assert.equal(new Headers(c.fetch[1].headers).get('authorization'),'Bearer derived-page')
 }
 assert.equal(s.calls.filter(c=>c.fetch).some(c=>String(c.fetch[1]?.headers?.Authorization||'').includes('expired-page')),false)
})
test('Reddedilen sistem tokenı eski sayfa tokenına sessizce dönmez',async()=>{
 const s=setup({env:{META_PAGE_ID:'900',META_SYSTEM_USER_TOKEN:'isolated-system',META_PAGE_ACCESS_TOKEN:'old'},fetcher:async()=>Response.json({error:{code:190}},{status:400})})
 assert.equal((await s.handler(s.req({action:'connection'},'valid-user'))).status,503)
 assert.equal(s.fetchCount(),1)
})

function setup(options:any={}) {
  const calls:any[]=[]
  const settings={enabled:false,security_ready:true,auto_sync:false,...options.settings}
  const envValues:any={SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-server-key',
    META_TEST_ONLY:'false',META_WORKER_SECRET:'isolated-worker-key',META_DATASET_ID:'123',META_CAPI_ACCESS_TOKEN:'isolated-capi-key',META_GRAPH_VERSION:'v99.0',META_TEST_EVENT_CODE:'ISOLATED',META_ALLOWED_ORIGINS:'https://crm.invalid',...options.env}
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

test('Staging kilidi ayar açıkken bile canlı enqueue ve retryyi kuyruktan önce reddeder',async()=>{
  const s=setup({env:{META_TEST_ONLY:'true'},settings:{enabled:true}})
  const r=await s.handler(s.req({...enqueue,retry:true},'valid-user'))
  assert.equal(r.status,409);assert.equal(s.calls.some(c=>c.rpc==='meta_enqueue_checked'||c.rpc==='meta_claim'),false);assert.equal(s.fetchCount(),0)
})

test('Staging kilidinde yalnızca kodlu test olayı gönderilir',async()=>{
  const s=setup({env:{META_TEST_ONLY:'true'},jobs:[{...job,test_mode:true}],fetcher:async()=>Response.json({events_received:1})})
  const r=await s.handler(s.req({...enqueue,action:'test'},'valid-user'))
  assert.equal(r.status,200);assert.equal(JSON.parse(s.calls.find(c=>c.fetch).fetch[1].body).test_event_code,'ISOLATED')
})

test('Staging kilidi beklenmedik canlı kuyruk satırını da göndermeden reddeder',async()=>{
  const s=setup({env:{META_TEST_ONLY:'true'},settings:{enabled:true},jobs:[job]})
  await s.handler(s.req({...enqueue,action:'test'},'valid-user'))
  assert.equal(s.fetchCount(),0);assert.equal(s.calls.find(c=>c.rpc==='meta_finish').args.p_result.state,'rejected')
})
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
test('Yüzüncü form sonrası form sayfalaması devam eder',async()=>{
  const urls:string[]=[]
  const s=setup({env:{META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'isolated-page'},fetcher:async(url:any)=>{
    urls.push(String(url));return Response.json({data:[{id:'101',name:'İzole son form'}]})
  }})
  const r=await s.handler(s.req({action:'pull',from:'2026-11-01',to:'2026-11-03',cursor:'second-form-page'},'valid-user'))
  assert.equal(r.status,200);assert.ok(urls[0].includes('after=second-form-page'))
  assert.equal((await r.json()).forms[0].id,'101')
})
test('Sonraki sayfadaki formun sahipliği doğrudan doğrulanır',async()=>{
  const urls:string[]=[]
  const s=setup({env:{META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'isolated-page'},fetcher:async(url:any)=>{
    urls.push(String(url));return String(url).includes('/101?')?Response.json({id:'101',name:'İzole form',page_id:'900'}):Response.json({data:[]})
  }})
  const r=await s.handler(s.req({action:'pull',from:'2026-11-01',to:'2026-11-03',formId:'101'},'valid-user'))
  assert.equal(r.status,200);assert.equal(urls.length,2);assert.equal(urls.some(x=>x.includes('leadgen_forms')),false)
})

for (const value of ['', 'TRUE', 'false ', '0']) test(`Test kilidi hatalı/eksik değerde üretimi açmaz: ${JSON.stringify(value)}`,async()=>{
  const s=setup({env:{META_TEST_ONLY:value},settings:{enabled:true}})
  assert.equal((await s.handler(s.req(enqueue,'valid-user'))).status,409)
  assert.equal(s.fetchCount(),0);assert.equal(s.calls.some(c=>c.rpc==='meta_enqueue_checked'),false)
})

const healthEnv={META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'isolated-page'}
const healthProvider=async(url:any)=>{
  const path=new URL(String(url)).pathname
  return Response.json(path.endsWith('/me')?{id:'900'}:path.endsWith('/leadgen_forms')?{data:[{id:'101'}]}:path.endsWith('/leads')?{data:[]}:{id:'123'})
}
test('Yönetici bağlantı testi sayfa, form, lead ve dataset erişimini olaysız doğrular',async()=>{
  const s=setup({env:healthEnv,fetcher:healthProvider})
  const r=await s.handler(s.req({action:'connection'},'valid-user')),body=await r.json()
  assert.equal(r.status,200);assert.equal(body.leadReadVerified,true);assert.equal(body.datasetVerified,true)
  assert.equal(s.fetchCount(),4);assert.equal(s.calls.some(c=>c.rpc==='meta_enqueue_checked'||c.rpc==='meta_claim'),false)
  assert.ok(s.calls.filter(c=>c.fetch).every(c=>!c.fetch[1].method||c.fetch[1].method==='GET'))
  assert.doesNotMatch(JSON.stringify(body),/isolated-page|isolated-capi-key/)
})
test('Bağlantı testi yanlış sayfa tokenını reddeder',async()=>{
  const s=setup({env:healthEnv,fetcher:async()=>Response.json({id:'901'})})
  assert.equal((await s.handler(s.req({action:'connection'},'valid-user'))).status,409);assert.equal(s.fetchCount(),1)
})
test('Bağlantı testi süresi dolmuş tokenı güvenli kodla açıklar',async()=>{
  const s=setup({env:healthEnv,fetcher:async()=>Response.json({error:{code:190,message:'private-provider-detail'}},{status:400})})
  const r=await s.handler(s.req({action:'connection'},'valid-user'));assert.equal(r.status,503)
  const text=await r.text();assert.match(text,/190/);assert.doesNotMatch(text,/private-provider-detail/)
})
test('Form bulunmazsa bağlantı testi lead yetkisi doğrulandı iddiasında bulunmaz',async()=>{
  const s=setup({env:healthEnv,fetcher:async(url:any)=>String(url).includes('/leadgen_forms')?Response.json({data:[]}):healthProvider(url)})
  const r=await s.handler(s.req({action:'connection'},'valid-user'));assert.equal(r.status,200);assert.equal((await r.json()).leadReadVerified,false)
})
test('Lead okuma izni hatası dataset başarısıyla gizlenmez',async()=>{
  const s=setup({env:healthEnv,fetcher:async(url:any)=>new URL(String(url)).pathname.endsWith('/leads')?Response.json({error:{code:200}},{status:403}):healthProvider(url)})
  const r=await s.handler(s.req({action:'connection'},'valid-user'));assert.equal(r.status,503);assert.match(await r.text(),/Lead okuma yetkisi/)
})

test('Dataset metadata 100 hatası gönderim hatası veya başarısı sayılmaz',async()=>{
  const s=setup({env:healthEnv,fetcher:async(url:any)=>new URL(String(url)).pathname.endsWith('/123')?Response.json({error:{code:100}},{status:400}):healthProvider(url)})
  const r=await s.handler(s.req({action:'connection'},'valid-user')),body=await r.json()
  assert.equal(r.status,200);assert.equal(body.leadReadVerified,true);assert.equal(body.datasetVerified,false)
  assert.equal(body.datasetReadWarning,100);assert.equal(body.eventSubmissionVerified,false)
  assert.equal(s.calls.some(c=>c.rpc==='meta_enqueue_checked'||c.rpc==='meta_claim'),false)
})
test('CAPI tokenının gerçek 190 hatası metadata uyarısı arkasına gizlenmez',async()=>{
  const s=setup({env:healthEnv,fetcher:async(url:any)=>new URL(String(url)).pathname.endsWith('/123')?Response.json({error:{code:190}},{status:400}):healthProvider(url)})
  const r=await s.handler(s.req({action:'connection'},'valid-user'));assert.equal(r.status,503);assert.match(await r.text(),/CAPI veri seti başarısız \(Meta 190\)/)
})
test('Başka dataset kimliği gelirse bağlantı doğrulanmış sayılmaz',async()=>{
  const s=setup({env:healthEnv,fetcher:async(url:any)=>new URL(String(url)).pathname.endsWith('/123')?Response.json({id:'999'}):healthProvider(url)})
  assert.equal((await s.handler(s.req({action:'connection'},'valid-user'))).status,502)
})

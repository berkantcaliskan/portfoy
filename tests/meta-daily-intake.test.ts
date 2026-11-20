import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createDailyIntakeHandler} from '../supabase/functions/_shared/meta-daily-intake.ts'
import {leadRangePath} from '../supabase/functions/_shared/meta-core.ts'

function setup(fail=false,state:any={}) {
 const calls:any[]=[],urls:string[]=[]
 const job={date:'2026-11-20',lease:'lease',from:'2026-11-19T21:00:00Z',to:'2026-11-20T07:00:00Z',state}
 const handler=createDailyIntakeHandler({env:name=>({SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'private',META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'page',META_GRAPH_VERSION:'v99.0'} as any)[name]||'',
  createClient:()=>({rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='meta_daily_intake_claim')return {data:job,error:null};if(name==='meta_ingest_lead')return fail?{error:{message:'failure'}}:{data:'saved',error:null};return {error:null}}}),
  fetcher:async(url:any)=>{urls.push(String(url));return Response.json(String(url).includes('leadgen_forms')?{data:[{id:'901',name:'Form'}]}:{data:[{id:'111',created_time:'2026-11-20T06:00:00Z',field_data:[{name:'full_name',values:['İzole']}]}]})}})
 return{handler,calls,urls,req:()=>new Request('https://isolated.invalid',{method:'POST',headers:{'x-cron-token':'a'.repeat(64)}})}
}
test('Günlük alım anonim çağrıyı reddeder; Meta gönderimi yapmaz',async()=>{
 const s=setup();assert.equal((await s.handler(new Request('https://isolated.invalid',{method:'POST'}))).status,401);assert.equal(s.calls.length,0)
})
test('Günlük alım gerçek kaynakla kaydeder ve tamamlanan imleci kalıcılaştırır',async()=>{
 const s=setup();const r=await s.handler(s.req());assert.equal(r.status,200);assert.equal((await r.json()).complete,true)
 assert.equal(s.calls.find(c=>c.name==='meta_ingest_lead').args.p.leadgenId,'111')
 assert.equal(s.calls.at(-1).args.p_complete,true)
 assert.equal(s.calls.some(c=>/enqueue|claim$/.test(c.name)&&c.name!=='meta_daily_intake_claim'),false)
 assert.equal(s.urls.some(u=>u.endsWith('/events')),false)
})
test('Kalıcı kayıt hatasında imleç ilerlemez ve tekrar deneme planlanır',async()=>{
 const s=setup(true);assert.equal((await s.handler(s.req())).status,503)
 assert.equal(s.calls.at(-1).args.p_error,true);assert.equal(s.calls.at(-1).args.p_complete,false)
})
test('Yeniden başlayan alım önceki form ve müşteri imlecinden devam eder',async()=>{
 const s=setup(false,{listed:true,forms:[{id:'901',name:'Form'}],index:0,leadCursor:'resume'})
 assert.equal((await s.handler(s.req())).status,200);assert.equal(s.urls.some(u=>u.includes('leadgen_forms')),false)
 assert.ok(s.urls[0].includes('after=resume'))
})
test('Meta tarih sorgusu time_created filtresiyle sınır saniyelerini içerir',()=>{
 const p=leadRangePath('901',Date.parse('2026-11-19T21:00:00Z'),Date.parse('2026-11-20T07:00:00Z'))
 const filters=JSON.parse(new URL('https://isolated.invalid/'+p).searchParams.get('filtering')!)
 assert.equal(filters[0].field,'time_created');assert.equal(filters[0].value,Date.parse('2026-11-19T21:00:00Z')/1000-1)
})

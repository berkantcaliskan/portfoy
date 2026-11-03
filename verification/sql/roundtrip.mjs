import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import {createHmac,createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {createWebhook} from '../../supabase/functions/_shared/meta-core.ts'
import {createCapiHandler} from '../../supabase/functions/_shared/meta-capi-handler.ts'

async function main() {
const db=new PGlite(),root=new URL('../../',import.meta.url)
const read=p=>fs.readFileSync(new URL(p,root),'utf8')
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
const schema=read('docs/supabase_schema.sql')
await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
await db.exec(read('supabase/migrations/202611030001_meta_source_context.sql'))
const admin='00000000-0000-0000-0000-000000000001'
await db.query('insert into auth.users values($1)',[admin])
await db.query('insert into meta_members(auth_user_id,is_admin,can_send) values($1,true,true)',[admin])
await db.exec('update meta_settings set security_ready=true,enabled=false')
let passed=0
async function check(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}

// Yalnızca test SDK adaptörü: gerçek Supabase/JWT servisine bağlanmaz. SQL/RPC kodu gerçektir.
const names={meta_ingest_lead:['p'],meta_set_stage:['p_user','p_lead','p_revision','p_stage','p_qualified'],
 meta_enqueue_checked:['p_user','p_lead','p_test','p_revision','p_event','p_leadgen_id'],
 meta_request_retry:['p_user','p_event'],meta_claim:['p_id','p_test_only'],meta_finish:['p_id','p_lease','p_result'],meta_list_sources:['p_user','p_lead']}
const ident=s=>{if(!/^[a-z_]+$/.test(s))throw Error('İzole test SQL alanı geçersiz.');return '"'+s+'"'}
const encode=v=>typeof v==='object'&&v!==null?JSON.stringify(v):v
class Query {
 constructor(table){this.table=table;this.fields='*';this.filters=[];this.values=[]}
 select(fields){this.fields=fields;return this}
 eq(column,value){this.filters.push([column,value]);return this}
 order(column,options){this.sort=[column,options?.ascending!==false];return this}
 limit(value){this.max=value;return this}
 update(values){this.values=Object.entries(values);return this}
 async execute(single=false){try{
  const params=[];const bind=v=>{params.push(encode(v));return '$'+params.length}
  const where=this.filters.map(([k,v])=>ident(k)+'='+bind(v)).join(' AND ')
  const fields=this.fields==='*'?'*':this.fields.split(',').map(ident).join(',')
  let sql
  if(this.values.length){
   const updates=this.values.map(([k,v])=>ident(k)+'='+bind(v)).join(',')
   sql='UPDATE '+ident(this.table)+' SET '+updates+(where?' WHERE '+where:'')+' RETURNING '+fields
  } else sql='SELECT '+fields+' FROM '+ident(this.table)+(where?' WHERE '+where:'')+(this.sort?' ORDER BY '+ident(this.sort[0])+(this.sort[1]?' ASC':' DESC'):'')+(this.max?' LIMIT '+Number(this.max):'')
  const result=await db.query(sql,params)
  return {data:single?(result.rows[0]||null):result.rows,error:null}
 }catch(error){return {data:null,error:{message:error.message}}}}
 single(){return this.execute(true)}
 maybeSingle(){return this.execute(true)}
 then(resolve,reject){return this.execute().then(resolve,reject)}
}
const client={auth:{getUser:async token=>({data:{user:token==='isolated-user'?{id:admin}:null},error:null})},
 from:table=>new Query(table),rpc:async(name,args)=>{try{
  const keys=names[name];if(!keys)throw Error('Bilinmeyen test RPC: '+name)
  const values=keys.map(k=>encode(args[k]??null)),params=keys.map((_,i)=>'$'+(i+1)).join(',')
  const rows=(await db.query((['meta_claim','meta_list_sources'].includes(name)?'SELECT * FROM ':'SELECT ')+name+'('+params+')'+(['meta_claim','meta_list_sources'].includes(name)?'':' AS result'),values)).rows
  return {data:['meta_claim','meta_list_sources'].includes(name)?rows:rows[0]?.result,error:null}
 }catch(error){return {data:null,error:{message:error.message}}}}}
const secret='isolated-app-secret',leadA='12345678901234567890',leadB='22345678901234567890',pageId='900'
const fields=[{name:'full_name',values:['İpek Yılmaz']},{name:'first_name',values:['İpek']},{name:'last_name',values:['Yılmaz']},
 {name:'phone_number',values:['05321234567']},{name:'email',values:[' TEST@EXAMPLE.INVALID ']},{name:'city',values:['İstanbul']},
 {name:'country',values:['Türkiye']},{name:'konut_tipi',values:['2+1','3+1']},{name:'butce_araligi',values:['5.000.000 - 8.000.000 TL']}]
const details=id=>({id,form_id:id===leadA?'111':'222',created_time:id===leadA?'2026-11-01T10:00:00Z':'2026-11-02T11:00:00Z',
 ad_id:id===leadA?'33333333333333333333':'44444444444444444444',ad_name:id===leadA?'İzole reklam A':'İzole reklam B',
 adset_id:'55555555555555555555',adset_name:'İzole reklam seti',campaign_id:'66666666666666666666',campaign_name:'İzole kampanya',
 platform:'ig',is_organic:false,field_data:fields})
const sent=[]
const provider=async(url,options={})=>{
 const parsed=new URL(url),id=parsed.pathname.split('/').at(-1)
 if(options.method==='POST'){sent.push(JSON.parse(options.body));return Response.json({events_received:1,fbtrace_id:'isolated-trace'})}
 if(id==='111'||id==='222')return Response.json({id,name:id==='111'?'İzole form A':'İzole form B'})
 if(id===leadA||id===leadB)return Response.json(details(id))
 throw Error('Gerçek ağa çıkış engellendi: test dışı hedef.')
}
const webhook=createWebhook({verifyToken:'isolated-verify',appSecret:secret,pageToken:'isolated-page',version:'v99.0',pageId,
 fetcher:provider,ingest:async p=>{const r=await client.rpc('meta_ingest_lead',{p});if(r.error)throw Error(r.error.message)}})
const notify=id=>{const body=JSON.stringify({object:'page',entry:[{id:pageId,changes:[{field:'leadgen',value:{leadgen_id:id,form_id:id===leadA?'111':'222'}}]}]});
 return webhook(new Request('https://isolated.invalid',{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')}}))}
const envs={SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-service',META_DATASET_ID:'777',META_CAPI_ACCESS_TOKEN:'isolated-capi',META_GRAPH_VERSION:'v99.0',META_TEST_EVENT_CODE:'ISOLATED_TEST'}
const capi=createCapiHandler({env:name=>envs[name]||'',createClient:()=>client,fetcher:provider})
const request=body=>capi(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify(body),headers:{Authorization:'Bearer isolated-user'}}))
let lead
await check('İmzalı iki Meta formu gerçek SQL ile aynı müşterinin iki başvurusu olur',async()=>{
 assert.equal((await notify(leadA)).status,200);assert.equal((await notify(leadB)).status,200)
 const rows=(await db.query('SELECT * FROM leads')).rows;assert.equal(rows.length,1);lead=rows[0]
 assert.equal(lead.inquiries.length,2);assert.equal((await db.query('SELECT * FROM meta_lead_events')).rows.length,2)
})
await check('İmzalı aynı bildirim tekrarı müşteri, başvuru ve aktiviteyi çoğaltmaz',async()=>{
 assert.equal((await notify(leadA)).status,200)
 assert.equal((await db.query('SELECT * FROM leads')).rows.length,1)
 assert.equal((await db.query('SELECT * FROM lead_activities')).rows.length,2)
 assert.equal((await db.query('SELECT jsonb_array_length(inquiries) AS n FROM leads')).rows[0].n,2)
})
await check('Form/reklam/kampanya kimlikleri ve tüm ham yanıtlar korunur',async()=>{
 const e=(await db.query('SELECT * FROM meta_lead_events WHERE leadgen_id=$1',[leadA])).rows[0]
 assert.equal(e.source_context.formName,'İzole form A');assert.equal(e.ad_id,details(leadA).ad_id)
 assert.equal(e.source_context.adsetId,'55555555555555555555');assert.equal(e.source_context.platform,'ig')
 assert.equal(e.source_context.isOrganic,false)
 assert.deepEqual(e.raw_fields,fields);assert.equal(e.source_context.phone,'905321234567')
 assert.equal(new Date(e.submitted_at).toISOString(),'2026-11-01T10:00:00.000Z')
})
await check('Gerçek handler/SQL aşama kaydı tek başına Meta olayı oluşturmaz',async()=>{
 const r=await request({action:'stage',leadId:lead.id,revision:0,stage:'QUALIFIED',qualified:true})
 assert.equal(r.status,200);assert.equal((await r.json()).revision,1)
 assert.equal((await db.query('SELECT * FROM meta_outbox')).rows.length,0);assert.equal(sent.length,0)
})
await check('Birden fazla başvuruda kaynak seçmeden gönderim reddedilir',async()=>{
 const r=await request({action:'test',leadId:lead.id,revision:1,eventName:'QualifiedLead'})
 assert.equal(r.status,409);assert.equal(sent.length,0);assert.equal((await db.query('SELECT * FROM meta_outbox')).rows.length,0)
})
await check('Sonraki başvuru mevcutken eski A başvurusu açık seçimle doğru leadgen ID taşır',async()=>{
 const r=await request({action:'test',leadId:lead.id,revision:1,eventName:'QualifiedLead',leadgenId:leadA})
 assert.equal(r.status,200);assert.equal((await r.json()).event.state,'sent')
 assert.equal(sent.length,1);assert.equal(sent[0].test_event_code,'ISOLATED_TEST')
 const e=sent[0].data[0];assert.equal(e.user_data.lead_id,leadA);assert.equal(e.user_data.page_id,pageId)
 assert.equal(e.event_name,'QualifiedLead');assert.equal(e.custom_data.crm_stage,'QUALIFIED')
 assert.equal(e.custom_data.form_id,'111');assert.equal(e.custom_data.ad_id,details(leadA).ad_id)
 assert.equal(e.custom_data.campaign_id,'66666666666666666666');assert.equal(e.action_source,'system_generated')
 const current=(await db.query('SELECT meta_changed_at FROM leads WHERE id=$1',[lead.id])).rows[0]
 assert.equal(e.event_time,Math.floor(new Date(current.meta_changed_at).getTime()/1000))
})
await check('E-posta/telefon/ad/şehir gerçek formdan normalize edilip SHA-256 çıkar',async()=>{
 const h=s=>createHash('sha256').update(s).digest('hex'),u=sent[0].data[0].user_data
 assert.deepEqual(u.ph,[h('905321234567')]);assert.deepEqual(u.em,[h('test@example.invalid')])
 assert.deepEqual(u.fn,[h('i\u0307pek')]);assert.deepEqual(u.ln,[h('yılmaz')]);assert.deepEqual(u.country,[h('tr')])
 assert.deepEqual(u.ct,[h('i\u0307stanbul')]);assert.deepEqual(u.external_id,[h(lead.id)])
})
await check('Müşteri bilgisi ve serbest form yanıtı ham halde CAPI gövdesine taşınmaz',async()=>{
 const e=sent[0].data[0],serialized=JSON.stringify(e)
 assert.equal(serialized.includes('TEST@EXAMPLE.INVALID'),false);assert.equal(serialized.includes('05321234567'),false)
 assert.equal(serialized.includes('İpek Yılmaz'),false);assert.equal('metaAnswers' in e.custom_data,false)
 assert.equal('value' in e.custom_data,false);assert.equal('currency' in e.custom_data,false)
 assert.equal('client_ip_address' in e.user_data,false);assert.equal('client_user_agent' in e.user_data,false)
 assert.equal('fbc' in e.user_data,false);assert.equal('fbp' in e.user_data,false)
})
await check('Aynı seçili başvuru/aynı aşama tekrarında ikinci CAPI gönderimi yoktur',async()=>{
 const r=await request({action:'test',leadId:lead.id,revision:1,eventName:'QualifiedLead',leadgenId:leadA,retry:true})
 assert.equal(r.status,200);assert.equal(sent.length,1)
})
await check('B başvurusu ayrıca açıkça seçilirse B kimliği ve ayrı stabil olay taşınır',async()=>{
 const r=await request({action:'test',leadId:lead.id,revision:1,eventName:'QualifiedLead',leadgenId:leadB})
 assert.equal(r.status,200);assert.equal(sent.length,2)
 assert.equal(sent[1].data[0].user_data.lead_id,leadB);assert.equal(sent[1].data[0].custom_data.form_id,'222')
 assert.notEqual(sent[0].data[0].event_id,sent[1].data[0].event_id)
})
await check('Başka müşteriye ait olmayan/uydurulmuş source ID gönderilemez',async()=>{
 const r=await request({action:'test',leadId:lead.id,revision:1,eventName:'QualifiedLead',leadgenId:'99999999999999999999'})
 assert.equal(r.status,409);assert.equal(sent.length,2)
})
await check('Kaynak sorgusu kimlik/atfı döndürür; iletişim verisini dökmez',async()=>{
 const r=await request({action:'sources',leadId:lead.id});assert.equal(r.status,200)
 const data=await r.json();assert.equal(data.sources.length,2)
 assert.equal(data.sources.some(s=>s.leadgenId===leadA&&s.formName==='İzole form A'),true)
 assert.equal(JSON.stringify(data).includes('TEST@EXAMPLE.INVALID'),false)
})
await check('Eksik form adı sonradan doğrulanınca inquiry ve kaynak zenginleşir; kopya doğmaz',async()=>{
 const id='32345678901234567890'
 const initial={leadgenId:id,fullName:'İzole Başka Kişi',phone:'905341234567',formId:'333',formName:'Bilinmeyen Meta formu',
   createdAt:'2026-11-01T12:00:00Z',fields:[{name:'full_name',values:['İzole Başka Kişi']}],answers:[],warnings:['FORM_NAME_UNAVAILABLE']}
 const first=await client.rpc('meta_ingest_lead',{p:initial});assert.equal(first.error,null)
 const second=await client.rpc('meta_ingest_lead',{p:{...initial,formName:'Doğrulanmış form',campaignId:'888',campaignName:'Doğrulanmış kampanya',warnings:[]}})
 assert.equal(second.data,first.data)
 const stored=(await db.query('SELECT inquiries FROM leads WHERE id=$1',[first.data])).rows[0]
 assert.equal(stored.inquiries.length,1);assert.equal(stored.inquiries[0].formName,'Doğrulanmış form');assert.deepEqual(stored.inquiries[0].metaWarnings,[])
 const source=(await db.query('SELECT source_context FROM meta_lead_events WHERE leadgen_id=$1',[id])).rows[0].source_context
 assert.equal(source.formName,'Doğrulanmış form');assert.equal(source.campaignName,'Doğrulanmış kampanya')
 assert.equal((await db.query('SELECT * FROM lead_activities WHERE lead_id=$1',[first.data])).rows.length,1)
})
console.log(`Uçtan uca izole zincir: ${passed}/${passed}. Gerçek Meta/Supabase hesabına bağlanılmadı.`)
await db.close()
}
main().catch(error=>{console.error('İzole uçtan uca test başarısız: '+error.message);process.exitCode=1})

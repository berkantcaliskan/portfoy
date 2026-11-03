import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, createHash } from 'node:crypto'
import { normalizePhone, verifySignature, createWebhook, normalizeLead, hash, stageEvent, buildCapiEvent, originalLeadId, deliveryResult, graphVersion, readBody, deliveryMode } from '../supabase/functions/_shared/meta-core.ts'

const secret='isolated-test-secret'
const sign=(body:string)=>'sha256='+createHmac('sha256',secret).update(body).digest('hex')
const payload={object:'page',entry:[{id:'123',changes:[{field:'leadgen',value:{leadgen_id:'456',form_id:'789',created_time:1793404800}}]}]}
const details={id:'456',form_id:'789',created_time:'2026-10-31T00:00:00Z',field_data:[{name:'full_name',values:['Test Kişi']},{name:'phone_number',values:['05321234567']},{name:'butce_araligi',values:['5.000.000 - 8.000.000 TL']},{name:'konut_tipi',values:['2+1']}]}
const config={verifyToken:'test-verify',appSecret:secret,pageToken:'test-page-token',version:'v99.0',pageId:'123'}
function setup(options: Record<string,any>={}) {
  const ingested:any[]=[]
  const handler=createWebhook({...config,fetcher:async()=>Response.json(details),ingest:async intake=>{ingested.push(intake)},...options})
  const request=(body=JSON.stringify(payload),signature:string|null=sign(body))=>new Request('https://test.invalid',{method:'POST',body,headers:signature?{'x-hub-signature-256':signature}:{}})
  return {handler,request,ingested}
}
for(const value of ['05321234567','5321234567','+90 532 123 45 67','00905321234567']) test(`Telefon eşdeğerliği: ${value}`,()=>assert.equal(normalizePhone(value),'905321234567'))
for(const value of ['', '1234567','+9050012345678','000','03121234567']) test(`Geçersiz/eksik telefon birleştirilmez: ${value}`,()=>assert.equal(normalizePhone(value),''))
test('Geçerli challenge',async()=>assert.equal(await (await setup().handler(new Request('https://test.invalid?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=abc'))).text(),'abc'))
test('Yanlış verify token',async()=>assert.equal((await setup().handler(new Request('https://test.invalid?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc'))).status,403))
test('Eksik server verify token',async()=>assert.equal((await setup({verifyToken:''}).handler(new Request('https://test.invalid'))).status,503))
test('Ham gövdenin geçerli HMAC imzası',async()=>assert.equal(await verifySignature(new TextEncoder().encode('a'),sign('a'),secret),true))
test('İmzadan sonra gövde değişimi reddedilir',async()=>assert.equal(await verifySignature(new TextEncoder().encode('b'),sign('a'),secret),false))
test('İmzalı geçerli webhook',async()=>{const s=setup();assert.equal((await s.handler(s.request())).status,200);assert.equal(s.ingested.length,1)})
test('Eksik imza',async()=>{const s=setup();assert.equal((await s.handler(s.request(undefined,null))).status,401);assert.equal(s.ingested.length,0)})
test('Yanlış imza',async()=>{const s=setup();assert.equal((await s.handler(s.request(undefined,'sha256='+'0'.repeat(64)))).status,401)})
test('İmzalı bozuk JSON',async()=>{const s=setup();assert.equal((await s.handler(s.request('{'))).status,400)})
test('Eksik lead ID',async()=>{const s=setup();const p=structuredClone(payload);delete (p.entry[0].changes[0].value as any).leadgen_id;assert.equal((await s.handler(s.request(JSON.stringify(p)))).status,400)})
test('Başka sayfa',async()=>{const s=setup();const p=structuredClone(payload);p.entry[0].id='999';assert.equal((await s.handler(s.request(JSON.stringify(p)))).status,403)})
test('Geçersiz payload',async()=>{const s=setup();assert.equal((await s.handler(s.request('{}'))).status,400)})
test('Graph API başarısız: başarı yanıtı yok',async()=>{const s=setup({fetcher:async()=>Response.json({error:{code:190}},{status:400})});assert.equal((await s.handler(s.request())).status,503);assert.equal(s.ingested.length,0)})
test('Graph ağ hatası',async()=>{const s=setup({fetcher:async()=>{throw new Error('timeout')}});assert.equal((await s.handler(s.request())).status,503)})
test('DB başarısız: teslim tekrar denenebilir',async()=>{const s=setup({ingest:async()=>{throw new Error('db failed')}});assert.equal((await s.handler(s.request())).status,503)})
test('Meta ID uyuşmazlığı',async()=>{const s=setup({fetcher:async()=>Response.json({...details,id:'999'})});assert.equal((await s.handler(s.request())).status,502)})
test('Başvuru zamanı ve soru yanıtları korunur; kampanya uydurulmaz',()=>{const n=normalizeLead(details,{leadgen_id:'456'});assert.equal(n.createdAt,details.created_time.replace('Z','.000Z'));assert.equal(n.campaignName,undefined);assert.equal(n.answers.length,4);assert.equal(n.budget,undefined);assert.equal(n.housingType,'2+1')})
test('Eksik telefon sahte numara olmaz',()=>assert.equal(normalizeLead({...details,field_data:[]},{leadgen_id:'456'}).phone,''))
test('API sürümü örtülü varsayılan almaz',()=>assert.throws(()=>graphVersion('')))
test('İletişim nitelik değildir; teklif ve kazanım otomatik Purchase değildir',()=>{assert.equal(stageEvent.CONTACTED,'Contact');assert.equal(stageEvent.QUALIFIED,'QualifiedLead');assert.equal(stageEvent.OFFER,null);assert.equal(stageEvent.WON,null);assert.equal(stageEvent.LOST,'DisqualifiedLead')})
const row={id:'stable-event-id',event_name:'QualifiedLead',occurred_at:'2026-10-31T00:00:00Z',snapshot:{id:'crm-id',stage:'QUALIFIED',is_qualified:true,meta_lead_id:'12345678901234567890',phone:'05321234567',email:' TEST@EXAMPLE.COM ',full_name:'İpek Test'}}
test('Nitelikli olay: orijinal ID sayı dönüşümünde bozulmaz',async()=>{const e=await buildCapiEvent(row);assert.equal(e.user_data.lead_id,row.snapshot.meta_lead_id);assert.equal(e.event_id,row.id);assert.equal(e.event_time,1793404800)})
test('Hash UTF-8 SHA-256 ve normalizasyon',async()=>{assert.equal(await hash(' İpek '),createHash('sha256').update('i\u0307pek').digest('hex'));const e=await buildCapiEvent(row);assert.deepEqual(e.user_data.ph,[createHash('sha256').update('905321234567').digest('hex')])})
test('Lead ID yoksa sentetik kimlik oluşturulmaz',async()=>{assert.equal(originalLeadId({id:'crm-id'}),undefined);await assert.rejects(buildCapiEvent({...row,snapshot:{...row.snapshot,meta_lead_id:undefined}}))})
test('İstemcinin inquiry kimliği doğrulanmış kaynak yerine kullanılamaz',()=>assert.equal(originalLeadId({inquiries:[{metaLeadgenId:'123'}]}),undefined))
test('Nitelik doğrulanmamışsa reddedilir',async()=>assert.rejects(buildCapiEvent({...row,snapshot:{...row.snapshot,is_qualified:false}})))
test('Olumsuz sinyal nitelikli sayılmaz',async()=>{const e=await buildCapiEvent({...row,event_name:'DisqualifiedLead',snapshot:{...row.snapshot,stage:'LOST',is_qualified:false}});assert.equal(e.event_name,'DisqualifiedLead')})
test('Purchase ve 1 TRY üretilmez',async()=>{await assert.rejects(buildCapiEvent({...row,event_name:'Purchase',snapshot:{...row.snapshot,stage:'WON'}}));const e=await buildCapiEvent(row);assert.equal('value' in e.custom_data,false);assert.equal('currency' in e.custom_data,false)})
test('Başarı yalnızca events_received=1 ile',()=>{assert.equal(deliveryResult(200,{events_received:1},1).state,'sent');assert.equal(deliveryResult(200,{},1).state,'rejected');assert.equal(deliveryResult(200,{events_received:0},1).state,'rejected');assert.equal(deliveryResult(200,{events_received:2},1).state,'rejected')})
test('Geçersiz access token kalıcı ret',()=>assert.equal(deliveryResult(400,{error:{code:190}},1).state,'rejected'))
test('Ağ zaman aşımı ve sunucu hatası geri çekilerek yeniden denenir',()=>{assert.equal(deliveryResult(0,null,1).retrySeconds,30);assert.equal(deliveryResult(503,null,2).retrySeconds,60);assert.equal(deliveryResult(429,null,3).retrySeconds,120)})
test('Meta API kalıcı validation hatası',()=>assert.equal(deliveryResult(400,{error:{code:100}},1).state,'rejected'))
test('Yeniden deneme en fazla beş deneme',()=>assert.equal(deliveryResult(503,null,5).state,'rejected'))
test('Retry event_id ve event_time sabit',async()=>assert.deepEqual(await buildCapiEvent(row),await buildCapiEvent(row)))
test('Demo worker üretim kapalıyken de gönderim yapamaz',()=>assert.throws(()=>deliveryMode({enabled:false,security_ready:true},'process')))
test('Üretim kapalıyken manuel canlı gönderim engellenir',()=>assert.throws(()=>deliveryMode({enabled:false,security_ready:true},'enqueue')))
test('Güvenli geçiş olmadan test kuyruğu da işlenmez',()=>assert.throws(()=>deliveryMode({enabled:false,security_ready:false},'process')))
test('Üretim açık bayrağı demo worker kilidini açamaz',()=>assert.throws(()=>deliveryMode({enabled:true,security_ready:true},'process')))
test('İstek gövdesi ham baytları değiştirmeden okunur',async()=>{const body='Türkçe gövde';const bytes=await readBody(new Request('https://test.invalid',{method:'POST',body}),100);assert.equal(new TextDecoder().decode(bytes),body)})
test('Content-Length olmayan büyük stream sınırlanır',async()=>{const req=new Request('https://test.invalid',{method:'POST',body:'123456789'});await assert.rejects(readBody(req,4),(e:any)=>e.status===413)})
test('İmzalı null JSON payload 400 ile reddedilir',async()=>{const s=setup();assert.equal((await s.handler(s.request('null'))).status,400)})

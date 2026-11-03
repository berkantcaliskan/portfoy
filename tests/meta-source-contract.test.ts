import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {graphLeadGet,normalizeLead,buildCapiEvent,metaId} from '../supabase/functions/_shared/meta-core.ts'
import {getMetaSourceChoices} from '../src/services/metaSources.ts'

test('Meta kimlikleri 64 bit sayı dönüşümü olmadan aynen kalır',()=>{
  const id='12345678901234567890';assert.equal(metaId(id),id);assert.equal(metaId(Number(id)),undefined)
  const p=normalizeLead({created_time:'2026-11-03T00:00:00Z',form_id:id,ad_id:id,adset_id:id,campaign_id:id,field_data:[]},{leadgen_id:id,page_id:id})
  assert.equal(p.leadgenId,id);assert.equal(p.formId,id);assert.equal(p.adId,id);assert.equal(p.adsetId,id);assert.equal(p.campaignId,id);assert.equal(p.pageId,id)
})
test('Normalize edilmiş e-posta boşluklu olsa da hash eşleştirmesine girer',async()=>{
  const e=await buildCapiEvent({id:'event',event_name:'QualifiedLead',occurred_at:'2026-11-03T00:00:00Z',snapshot:{id:'crm',stage:'QUALIFIED',is_qualified:true,meta_lead_id:'123',email:' TEST@EXAMPLE.COM ',full_name:'Test Kişi'}})
  assert.deepEqual(e.user_data.em,[createHash('sha256').update('test@example.com').digest('hex')])
})
test('Gerçek profil ve seçilen kaynak iletişim hashleri tekilleştirilir',async()=>{
  const e=await buildCapiEvent({id:'event',event_name:'Contact',occurred_at:'2026-11-03T00:00:00Z',snapshot:{id:'crm',stage:'CONTACTED',meta_lead_id:'123',phone:'05321234567',email:'test@example.com',meta_source:{phone:'+90 532 123 45 67',email:' TEST@EXAMPLE.COM '}}})
  assert.equal((e.user_data.ph as string[]).length,1);assert.equal((e.user_data.em as string[]).length,1)
})
test('Reklam alanı yetkisi eksikse temel PM ve form yanıtları kaybolmaz',async()=>{
  const urls:string[]=[]
  const result=await graphLeadGet('123','isolated','v99.0',async url=>{
    urls.push(String(url));return urls.length===1?Response.json({error:{code:200}},{status:403}):Response.json({id:'123',created_time:'2026-11-03T00:00:00Z',form_id:'456',field_data:[{name:'email',values:['test@example.invalid']}]})
  })
  assert.equal(urls.length,2);assert.equal(result.id,'123');assert.equal(result.field_data.length,1)
  assert.ok(result.__metaWarnings.includes('ATTRIBUTION_RESTRICTED'))
  assert.equal(urls[1].includes('campaign_name'),false)
})
test('Geçersiz token temel alan fallback ile başarıya çevrilmez',async()=>{
  let calls=0
  await assert.rejects(graphLeadGet('123','isolated','v99.0',async()=>{calls++;return Response.json({error:{code:190}},{status:400})}))
  assert.equal(calls,1)
})
test('Form listesi sayfalamasında cursor ve zaman kapsamı fallbackte korunur',async()=>{
  const urls:string[]=[]
  const result=await graphLeadGet('111/leads?limit=25&after=abc&since=10&until=20','isolated','v99.0',async url=>{
    urls.push(String(url));return urls.length===1?Response.json({error:{code:100}},{status:400}):Response.json({data:[{id:'123'}],paging:{cursors:{after:'next'},next:'provider-paging'}})
  })
  assert.ok(urls[1].includes('after=abc'));assert.ok(urls[1].includes('since=10'));assert.equal(result.paging.cursors.after,'next');assert.ok(result.data[0].__metaWarnings.length)
})
test('Aynı müşterinin iki Meta formu ayrı seçilebilir başvuru olarak kalır',()=>{
  const choices=getMetaSourceChoices({id:'crm',metaLeadId:'111',inquiries:[{metaLeadgenId:'111',formName:'Form A',createdAt:'2026-11-01T10:00:00Z'},{metaLeadgenId:'222',formName:'Form B',createdAt:'2026-11-02T10:00:00Z'}]} as any)
  assert.deepEqual(choices.map(c=>c.id),['111','222']);assert.ok(choices[0].label.includes('Form A'));assert.ok(choices[1].label.includes('Form B'))
})
test('Bilinmeyen reklam/kampanya kimliği CAPIye uydurulmaz',async()=>{
  const e=await buildCapiEvent({id:'event',event_name:'Contact',occurred_at:'2026-11-03T00:00:00Z',snapshot:{id:'crm',stage:'CONTACTED',meta_lead_id:'123',meta_source:{formId:'456'}}})
  assert.equal(e.custom_data.form_id,'456');assert.equal('ad_id' in e.custom_data,false);assert.equal('campaign_id' in e.custom_data,false)
})
test('Türkçe form başlıkları telefon ve e-postayı kaybettirmez',()=>{
  const p=normalizeLead({created_time:'2026-11-03T00:00:00Z',field_data:[
    {name:'Adınız Soyadınız',values:['İzole Test']},{name:'Telefon Numaranız',values:['05321234567']},
    {name:'E-posta Adresi',values:[' TEST@EXAMPLE.INVALID ']},
  ]},{leadgen_id:'123'})
  assert.equal(p.fullName,'İzole Test');assert.equal(p.phone,'905321234567');assert.equal(p.email,'TEST@EXAMPLE.INVALID')
  assert.equal(p.fields[1].name,'Telefon Numaranız')
})

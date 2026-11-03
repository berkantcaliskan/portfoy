import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readMetaLeadResponse} from '../src/services/metaGraphResponse.ts'

test('Geçerli boş liste başarılı alım sonucudur',async()=>{
  assert.deepEqual(await readMetaLeadResponse(Response.json({data:[]})),{data:[]})
})
test('Lead izin hatası boş listeye çevrilmez ve ham mesaj açığa çıkmaz',async()=>{
  await assert.rejects(readMetaLeadResponse(Response.json({error:{code:200,message:'private-provider-detail'}},{status:403})),e=>{
    assert.match((e as Error).message,/izinleri eksik/);assert.doesNotMatch((e as Error).message,/private-provider-detail/);return true
  })
})
test('Süresi dolmuş token açıkça bildirilir',async()=>{
  await assert.rejects(readMetaLeadResponse(Response.json({error:{code:190}},{status:400})),/süresi dolmuş/)
})
test('HTTP 200 içinde Meta hatası başarı değildir',async()=>{
  await assert.rejects(readMetaLeadResponse(Response.json({error:{code:10}})),/tamamlanmadı/)
})
test('Bozuk JSON ve eksik liste başarı sayılmaz',async()=>{
  await assert.rejects(readMetaLeadResponse(new Response('broken')),/geçerli bir lead listesi/)
  await assert.rejects(readMetaLeadResponse(Response.json({})),/geçerli bir lead listesi/)
})

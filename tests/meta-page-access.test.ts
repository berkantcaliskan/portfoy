import {test} from 'node:test'
import assert from 'node:assert/strict'
import {getMetaPageAccess,resolveMetaPageAccess} from '../supabase/functions/_shared/meta-page-access.ts'
import {createWebhook} from '../supabase/functions/_shared/meta-core.ts'
import {createHmac} from 'node:crypto'

const env=(values:Record<string,string>)=>(name:string)=>values[name]||''
test('Sistem sırrı hedef sayfa tokenına yalnızca sunucuda dönüştürülür',async()=>{
 const result=await resolveMetaPageAccess(env({META_PAGE_ID:'900',META_SYSTEM_USER_TOKEN:'system'}),'v26.0',async(url,init)=>{
  assert.ok(String(url).endsWith('/900?fields=id,access_token'))
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer system')
  return Response.json({id:'900',access_token:'derived'})
 })
 assert.equal(result.token,'derived')
})
test('Yanlış sayfa veya eksik Page tokenı eski sırla gizlenmez',async()=>{
 for(const data of [{id:'other',access_token:'derived'},{id:'900'}]){
  await assert.rejects(resolveMetaPageAccess(env({META_PAGE_ID:'900',META_SYSTEM_USER_TOKEN:'system',META_PAGE_ACCESS_TOKEN:'old'}),'v26.0',async()=>Response.json(data)))
 }
})
test('Eski Page tokenı yolunda ek token sorgusu yapılmaz',async()=>{
 const result=await resolveMetaPageAccess(env({META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'page'}),'v26.0',async()=>{throw Error('must not fetch')})
 assert.equal(result.token,'page')
})
test('Sistem kullanıcısı eski sayfa tokenından önceliklidir',()=>{
 assert.deepEqual(getMetaPageAccess(env({META_PAGE_ID:'900',META_SYSTEM_USER_TOKEN:'system',META_PAGE_ACCESS_TOKEN:'old'})),{pageId:'900',token:'system',mode:'SYSTEM_USER'})
})
test('Sistem sırrı yoksa mevcut sayfa tokenı uyumluluğu korunur',()=>{
 assert.equal(getMetaPageAccess(env({META_PAGE_ID:'900',META_PAGE_ACCESS_TOKEN:'page'})).mode,'PAGE')
})
test('Eksik sır veya geçersiz sayfa kimliği reddedilir',()=>{
 assert.throws(()=>getMetaPageAccess(env({META_PAGE_ID:'900'})))
 assert.throws(()=>getMetaPageAccess(env({META_PAGE_ID:'../me',META_SYSTEM_USER_TOKEN:'system'})))
})
test('İmzasız ve yanlış imzalı webhook erişim sırrını çözümlemez',async()=>{
 let resolved=0
 const handler=createWebhook({verifyToken:'verify',appSecret:'secret',pageToken:'',pageId:'900',version:'v26.0',resolveAccessToken:()=>{resolved++;return 'system'},ingest:async()=>{}})
 for(const signature of ['',`sha256=${'0'.repeat(64)}`]){
  const r=await handler(new Request('https://isolated.invalid',{method:'POST',body:'{}',headers:{'x-hub-signature-256':signature}}))
  assert.equal(r.status,401)
 }
 assert.equal(resolved,0)
})
test('İmzalı webhook sistem sırrını kullanarak kaydeder; çözümleme hatası tekrar denenebilir',async()=>{
 const body=JSON.stringify({object:'page',entry:[{id:'900',changes:[{field:'leadgen',value:{leadgen_id:'901'}}]}]})
 const signature='sha256='+createHmac('sha256','secret').update(body).digest('hex')
 const request=()=>new Request('https://isolated.invalid',{method:'POST',body,headers:{'x-hub-signature-256':signature}})
 let ingested=0,resolved=0
 const config={verifyToken:'verify',appSecret:'secret',pageToken:'',pageId:'900',version:'v26.0',ingest:async()=>{ingested++}}
 const handler=createWebhook({...config,resolveAccessToken:()=>{resolved++;return 'system'},fetcher:async(_url,init)=>{
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer system')
  return Response.json({id:'901',created_time:'2026-11-04T00:00:00Z',field_data:[]})
 }})
 assert.equal((await handler(request())).status,200);assert.equal(ingested,1);assert.equal(resolved,1)
 const failed=createWebhook({...config,resolveAccessToken:()=>{throw Error('isolated failure')}})
 assert.equal((await failed(request())).status,503);assert.equal(ingested,1)
})

// Yalnızca açıkça belirtilmiş test projesine negatif/okuma kontrolleri yapar.
// Gerçek lead oluşturmaz, sır yazmaz veya CAPI dönüşümü göndermez.
import fs from 'node:fs'
import assert from 'node:assert/strict'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}))
const base=env.VITE_SUPABASE_URL
if(process.argv[2]!==base || !base?.startsWith('https://') || env.VITE_ENABLE_SUPABASE_SYNC!=='false') throw Error('Kullanım: node scripts/verify-meta-staging.mjs <tam-test-projesi-url>; genel sync kapalı olmalı.')
const key=env.VITE_SUPABASE_ANON_KEY
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
const cases=[
 ['CAPI anonim erişim','/functions/v1/meta-capi',post({action:'status'}),[401]],
 ['CAPI geçersiz JWT','/functions/v1/meta-capi',{...post({action:'status'}),headers:{'Content-Type':'application/json',Authorization:'Bearer invalid-isolated-token'}},[401]],
 ['CAPI izin dışı origin','/functions/v1/meta-capi',{...post({action:'status'}),headers:{'Content-Type':'application/json',Origin:'https://untrusted.invalid'}},[403]],
 ['CAPI anonim worker','/functions/v1/meta-capi',post({action:'process'}),[401]],
 ['CAPI izinli preflight','/functions/v1/meta-capi',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:9002'}},[200]],
 ['Webhook imzasız','/functions/v1/meta-webhook',post({object:'page',entry:[]}),[401]],
 ['Webhook yanlış imza','/functions/v1/meta-webhook',{...post({object:'page',entry:[]}),headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+'0'.repeat(64)}},[401]],
 ['Webhook yanlış challenge değeri','/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=invalid-test-value&hub.challenge=verification',{},[403]],
 ['Webhook desteklenmeyen yöntem','/functions/v1/meta-webhook',{method:'PUT'},[405]],
 ['Anonim müşteri okuma','/rest/v1/leads?select=id&limit=1',{headers:{apikey:key}},[401,403]],
 ['Anonim ingestion RPC','/rest/v1/rpc/meta_ingest_lead',{...post({p:{}}),headers:{apikey:key,'Content-Type':'application/json'}},[401,403]],
]
for(const [name,url,options,expected] of cases){
 const r=await fetch(base+url,{...options,signal:AbortSignal.timeout(15000)})
 await r.arrayBuffer() // Yanıt gövdeleri kişisel veri içerebilir; yazdırılmaz.
 assert.ok(expected.includes(r.status),`${name}: beklenmeyen HTTP ${r.status}`)
 if(name==='CAPI izinli preflight') assert.equal(r.headers.get('access-control-allow-origin'),'http://127.0.0.1:9002')
 console.log(`GEÇTİ: ${name} — HTTP ${r.status}`)
}
console.log(`Test projesi HTTP kontrolleri: ${cases.length}/${cases.length}. Dönüşüm gönderilmedi.`)

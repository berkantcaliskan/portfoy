// Güvenilir yerel yedek dosyasını SALT OKUNUR sayar. İçerik, kullanıcı adı,
// parola ve iletişim bilgisi çıktılanmaz. Kaynak dosyayı değiştirmez.
import fs from 'node:fs'
import crypto from 'node:crypto'
const file=process.argv[2]
if(!file){console.error('Kullanım: node scripts/crm-local-inventory.mjs <yerel-yedek.json>');process.exit(1)}
try{
 const bytes=fs.readFileSync(file),store=JSON.parse(bytes.toString('utf8'))
 if(!store||typeof store!=='object'||Array.isArray(store))throw Error('invalid')
 const modules={demirturk_leads_v2:'customers',demirturk_users_v2:'staff',demirturk_projects_v2:'projects',demirturk_appointments_v2:'appointments',demirturk_requests_v2:'requests',demirturk_collections_v2:'collections',demirturk_payments_v2:'payments',demirturk_approvals_v2:'approvals',demirturk_shared_files_v2:'files'}
 const counts={}
 for(const [key,module] of Object.entries(modules)){
  const value=typeof store[key]==='string'?JSON.parse(store[key]):store[key]
  counts[module]=Array.isArray(value)?{count:value.length,missingIds:value.filter(r=>!r||typeof r.id!=='string'||!r.id).length}:value===undefined?{count:0}:{invalid:true}
 }
 console.log(JSON.stringify({sha256:crypto.createHash('sha256').update(bytes).digest('hex'),counts},null,2))
}catch{console.error('Yerel yedek okunamadı veya beklenen veri biçiminde değil; dosya değiştirilmedi.');process.exitCode=1}

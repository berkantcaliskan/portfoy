import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('./package.json',import.meta.url))
const {PGlite}=require('@electric-sql/pglite')
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),db=new PGlite()
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`)
const schema=read('docs/supabase_schema.sql');await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
const ids={admin:'00000000-0000-0000-0000-000000000001',member:'00000000-0000-0000-0000-000000000002',other:'00000000-0000-0000-0000-000000000003',finance:'00000000-0000-0000-0000-000000000004'}
for(const [name,id] of Object.entries(ids)){
 await db.query('INSERT INTO auth.users VALUES($1)',[id])
 await db.query("INSERT INTO app_users(id,full_name,username,password,department,role,scope,company_name) VALUES($1,$1,$1,'isolated-only',$2,$3,'ASSIGNED_ONLY',$4)",[name,name==='finance'?'Muhasebe':'Pazarlama',name==='admin'?'ADMIN':'MEMBER',name==='other'?'Other Company':'Company'])
}
await db.exec(read('supabase/migrations/202611040001_crm_identity_foundation.sql'))
for(const [name,id] of Object.entries(ids))await db.query('INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)',[id,name])
const before=(await db.query("SELECT count(*)::int AS n FROM meta_members")).rows[0].n
const migration=read('supabase/migrations/202611050001_crm_record_backend.sql')
await db.exec(migration)
let passed=0,request=1
async function test(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}
const requestId=()=>`10000000-0000-0000-0000-${String(request++).padStart(12,'0')}`
async function as(user,fn,role='authenticated'){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[user]||''])
 await db.exec('SET ROLE '+role);try{return await fn()}finally{await db.exec('RESET ROLE')}
}
const write=(module,id,revision,payload={id},req=requestId(),archive=false)=>db.query('SELECT crm_backend_write($1,$2,$3,$4,$5::jsonb,$6) AS result',[req,module,id,revision,JSON.stringify(payload),archive]).then(r=>r.rows[0].result)
const list=(module,after='',limit=50)=>db.query('SELECT crm_backend_list($1,$2,$3) AS result',[module,after,limit]).then(r=>r.rows[0].result)
await test('Eklemeli migration tekrar uygulanabilir; Meta üyeliği değişmez',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM meta_members')).rows[0].n,before)})
await test('Anonim ve eşlemesiz kullanıcı listeleri okuyamaz',async()=>{
 await as('',()=>assert.rejects(list('projects')),'anon');await as('',()=>assert.rejects(list('projects')))
})
await test('Yeni modüllerin yazımı sunucuda kapalı başlar',()=>as('admin',()=>assert.rejects(write('projects','p',0),/crm_module_not_activated/)))
await db.exec('UPDATE crm_backend.module_settings SET write_enabled=true')
await test('İstemci tabloya ve audit kayıtlarına doğrudan erişemez',()=>as('admin',async()=>{
 await assert.rejects(db.query('SELECT * FROM crm_backend.records'));await assert.rejects(db.query('DELETE FROM crm_backend.write_audit'))
}))
await test('Yönetici proje oluşturur; nested daire ve çizim bilgisi kaybolmaz',()=>as('admin',async()=>{
 const result=await write('projects','p',0,{id:'p',units:[{id:'unit',custom:{x:3}}],layout:{blocks:[1,2]}});assert.equal(result.revision,1)
 const row=(await list('projects')).records[0];assert.deepEqual(row.payload.units,[{id:'unit',custom:{x:3}}]);assert.equal(row.owner_id,'admin')
}))
await test('Personel projeleri okur ancak proje yazamaz',()=>as('member',async()=>{assert.equal((await list('projects')).records.length,1);await assert.rejects(write('projects','forged',0),/crm_forbidden/)}))
await test('Aynı işlem tekrarında revision ve audit çoğalmaz',()=>as('admin',async()=>{
 const req=requestId(),payload={id:'p',name:'updated'};const a=await write('projects','p',1,payload,req);const b=await write('projects','p',1,payload,req)
 assert.equal(a.revision,2);assert.equal(b.revision,2);assert.equal(b.replayed,true)
 await assert.rejects(write('projects','p',1,{id:'p',name:'different'},req),/crm_request_conflict/)
}))
await test('Eski revision başka istemcinin değişikliğini ezemez',()=>as('admin',async()=>{await assert.rejects(write('projects','p',1),/crm_revision_conflict/);assert.equal((await list('projects')).records[0].revision,2)}))
await test('Yeni kayıt aynı kimlikle revision sıfırdan tekrar yaratılamaz',()=>as('admin',()=>assert.rejects(write('projects','p',0),/crm_revision_conflict/)))
await test('Şirket sınırı yönetici dahil korunur',()=>as('other',async()=>{assert.equal((await list('projects')).records.length,0);await assert.rejects(write('projects','p',2),/crm_forbidden/)}))
await test('Randevu sahibi sunucu kimliğidir; başka kişi alanı yetki sağlamaz',()=>as('member',async()=>{
 await write('appointments','a',0,{id:'a',owner_id:'admin',createdByUserId:'admin'});const row=(await list('appointments')).records[0];assert.equal(row.owner_id,'member')
}))
await test('Başka personel randevu içeriğini okuyamaz veya değiştiremez',()=>as('finance',async()=>{assert.equal((await list('appointments')).records.length,0);await assert.rejects(write('appointments','a',1),/crm_forbidden/)}))
await test('Muhasebe kayıtları genel personele kapalıdır',async()=>{
 await as('finance',()=>write('payments','money',0,{id:'money',amount:100}));await as('member',async()=>{assert.equal((await list('payments')).records.length,0);await assert.rejects(write('payments','x',0),/crm_forbidden/)})
})
await test('Genel kayıt endpointi onay kararı veremez',()=>as('admin',()=>assert.rejects(write('approvals','approval',0,{id:'approval',status:'ONAYLANDI'}),/crm_approval_workflow_required/)))
await test('Bilinmeyen modül, null ve geçersiz kimlik reddedilir',()=>as('admin',async()=>{
 await assert.rejects(write('meta_outbox','x',0),/crm_invalid_input/);await assert.rejects(write('projects','x',0,{id:'other'}),/crm_invalid_input/)
 await assert.rejects(list('projects','',0),/crm_invalid_input/);await assert.rejects(list('projects','',101),/crm_invalid_input/)
}))
await test('Sayfalama kimlik sırasını korur ve sonraki kaydı belirtir',()=>as('admin',async()=>{
 await write('projects','p2',0);await write('projects','p3',0);const page=await list('projects','',1);assert.equal(page.records[0].id,'p');assert.equal(page.has_more,true)
 assert.equal((await list('projects','p',1)).records[0].id,'p2')
}))
await test('Arşivleme fiziksel silmez, eski istemci kaydı diriltemez',async()=>{
 await as('admin',()=>write('projects','p3',1,{},requestId(),true))
 const row=(await db.query("SELECT deleted,revision FROM crm_backend.records WHERE id='p3'")).rows[0];assert.equal(row.deleted,true);assert.equal(Number(row.revision),2)
 await as('admin',()=>assert.rejects(write('projects','p3',2),/crm_revision_conflict/))
})
await test('Audit yazımı başarısızsa kayıt değişikliği de geri alınır',async()=>{
 await db.exec("CREATE FUNCTION crm_backend.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'isolated audit failure';END$$;CREATE TRIGGER fail_audit BEFORE INSERT ON crm_backend.write_audit FOR EACH ROW EXECUTE FUNCTION crm_backend.fail_audit()")
 await as('admin',()=>assert.rejects(write('projects','p2',1,{id:'p2',changed:true}),/isolated audit failure/))
 assert.equal((await db.query("SELECT revision::int AS revision FROM crm_backend.records WHERE id='p2'")).rows[0].revision,1)
 await db.exec('DROP TRIGGER fail_audit ON crm_backend.write_audit')
})
await test('Devre dışı kimlik eski oturumla dahi okuyamaz',async()=>{
 await db.query('UPDATE crm_identities SET active=false WHERE app_user_id=$1',['member']);await as('member',()=>assert.rejects(list('projects'),/crm_identity_not_assigned/))
})
await test('Migration tekrarı yazım kilidini veya veriyi sıfırlamaz',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_backend.records')).rows[0].n,5);assert.equal((await db.query("SELECT write_enabled FROM crm_backend.module_settings WHERE module='projects'")).rows[0].write_enabled,true)})
await db.close();console.log(`CRM backend SQL: ${passed}/${passed}; izole motor, gerçek çok oturumlu yarış testi değildir.`)

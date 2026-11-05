import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('./package.json',import.meta.url))
const {PGlite}=require('@electric-sql/pglite')
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8')
const db=new PGlite(),migration=read('supabase/migrations/202611040001_crm_identity_foundation.sql')
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
const schema=read('docs/supabase_schema.sql');await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
const admin='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002'
await db.query('INSERT INTO auth.users VALUES($1),($2)',[admin,other])
await db.exec("INSERT INTO app_users(id,full_name,username,password,department,role,scope) VALUES('employee','İzole Yönetici','isolated','not-a-real-password','Yönetim','ADMIN','ALL');")
await db.query("INSERT INTO meta_members(auth_user_id,app_user_id,is_admin) VALUES($1,'employee',true)",[admin])
await db.exec(migration)
let passed=0
async function test(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}
await test('Yalnızca mevcut doğrulanmış eşleme devralınır',async()=>{assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_identities')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM meta_members')).rows[0].n,1)})
await test('Anonim kullanıcı merkezi profile erişemez',async()=>{await db.exec('SET ROLE anon');try{await assert.rejects(db.query('SELECT crm_get_my_profile()'))}finally{await db.exec('RESET ROLE')}})
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin])
await test('Doğrulanmış kullanıcı güvenli profil alır; parola dönmez',async()=>{
 await db.exec('SET ROLE authenticated');try{const p=(await db.query('SELECT crm_get_my_profile() AS p')).rows[0].p;assert.equal(p.auth_user_id,admin);assert.equal(p.role,'ADMIN');assert.equal('password' in p,false)}finally{await db.exec('RESET ROLE')}
})
await test('İstemci kendi personel eşlemesini değiştiremez',async()=>{
 await db.exec('SET ROLE authenticated');try{await assert.rejects(db.query('UPDATE crm_identities SET active=false'))}finally{await db.exec('RESET ROLE')}
})
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other])
await test('Eşlenmemiş Auth kullanıcısı profil veya başka eşlemeyi okuyamaz',async()=>{
 await db.exec('SET ROLE authenticated');try{await assert.rejects(db.query('SELECT crm_get_my_profile()'));assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_identities')).rows[0].n,0)}finally{await db.exec('RESET ROLE')}
})
await db.exec('UPDATE crm_identities SET active=false')
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin])
await test('Devre dışı personel profili reddedilir',async()=>assert.rejects(db.query('SELECT crm_get_my_profile()')))
await test('Migration tekrarı devre dışı kullanıcıyı yeniden açmaz',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT active FROM crm_identities')).rows[0].active,false)})
await db.close()
console.log(`CRM Auth SQL: ${passed}/${passed}; gerçek hesaplara bağlanılmadı.`)

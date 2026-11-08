import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('./package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite')
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8')
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'portfoy-crm-test-'))
let db=new PGlite(directory),passed=0
const ids={admin:'00000000-0000-0000-0000-000000000001',staff:'00000000-0000-0000-0000-000000000002',wrong:'00000000-0000-0000-0000-000000000003',unconfirmed:'00000000-0000-0000-0000-000000000004',member:'00000000-0000-0000-0000-000000000005'}
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`)
const schema=read('docs/supabase_schema.sql');await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
for(const [name,id] of Object.entries(ids))await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name+'@example.invalid',name==='unconfirmed'?null:new Date().toISOString()])
await db.exec("INSERT INTO app_users(id,full_name,username,password,department,role,company_name) VALUES('admin','Isolated admin','admin','unused','Yönetim','ADMIN','Company'),('member','Isolated member','member','unused','Satış','MEMBER','Company')")
await db.query("INSERT INTO meta_members(auth_user_id,app_user_id,is_admin) VALUES($1,'admin',true)",[ids.admin])
await db.exec(read('supabase/migrations/202611040001_crm_identity_foundation.sql'))
await db.query("INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,'member')",[ids.member])
await db.exec(read('supabase/migrations/202611050001_crm_record_backend.sql'))
const migration=read('supabase/migrations/202611050002_crm_onboarding_and_probe.sql');await db.exec(migration)
async function test(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}
async function as(user,fn,role='authenticated'){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[user]||'']);await db.exec('SET ROLE '+role);try{return await fn()}finally{await db.exec('RESET ROLE')}}
const create=(email,role='MEMBER')=>db.query("SELECT crm_create_staff_invite($1,'Isolated staff','Satış',$2,'ASSIGNED_ONLY') AS r",[email,role]).then(r=>r.rows[0].r)
const claim=token=>db.query('SELECT crm_accept_staff_invite($1) AS r',[token||null]).then(r=>r.rows[0].r)
const probe=()=>db.query('SELECT crm_get_persistence_probe() AS r').then(r=>r.rows[0].r)
const save=(request,revision,note)=>db.query('SELECT crm_save_persistence_probe($1,$2,$3) AS r',[request,revision,note]).then(r=>r.rows[0].r)
const req='10000000-0000-0000-0000-000000000001'
let invite
try{
await test('Migration tekrarlanabilir; Meta üyeliği aynı kalır',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM meta_members')).rows[0].n,1)})
await test('Anonim kullanıcı yönetici daveti veya kalıcılık kaydı oluşturamaz',()=>as('',async()=>{await assert.rejects(create('x@example.invalid'));await assert.rejects(save(req,0,'test'))},'anon'))
await test('Personel kendi rolünü yönetici yaparak davet oluşturamaz',()=>as('member',()=>assert.rejects(create('x@example.invalid'),/crm_admin_required/)))
await test('Yönetici daveti de ADMIN rolü veremez',()=>as('admin',()=>assert.rejects(create('x@example.invalid','ADMIN'),/crm_invalid_input/)))
await test('Ham davet tokenı DB içinde tutulmaz',async()=>{
 invite=await as('admin',()=>create('staff@example.invalid'))
 const row=(await db.query('SELECT token_hash FROM crm_backend.staff_invites WHERE id=$1',[invite.id])).rows[0]
 assert.match(row.token_hash,/^[a-f0-9]{64}$/);assert.notEqual(row.token_hash,invite.token)
})
await test('Aynı e-posta için ikinci etkin davet reddedilir',()=>as('admin',()=>assert.rejects(create('staff@example.invalid'),/crm_invite_already_pending/)))
await test('Davet ön kontrolü yalnızca doğru token ve e-postada açılır',()=>as('',async()=>{
 const row=(await db.query('SELECT crm_check_staff_invite($1,$2) AS r',[invite.token,'staff@example.invalid'])).rows[0].r;assert.equal(row.valid,true)
 await assert.rejects(db.query('SELECT crm_check_staff_invite($1,$2)',[invite.token,'wrong@example.invalid']),/crm_invite_invalid/)
},'anon'))
await test('Başka e-posta daveti sahiplenemez',()=>as('wrong',()=>assert.rejects(claim(invite.token),/crm_invite_invalid/)))
await test('Doğrulanmamış e-posta rol alamaz',async()=>{
 const item=await as('admin',()=>create('unconfirmed@example.invalid'));await as('unconfirmed',()=>assert.rejects(claim(item.token),/crm_email_confirmation_required/))
})
await test('Davet kabulü sadece sunucudaki rolü atar; profilde parola yoktur',async()=>{
 const p=await as('staff',()=>claim(invite.token));assert.equal(p.role,'MEMBER');assert.equal(p.department,'Satış');assert.equal('password'in p,false)
 const raw=(await db.query('SELECT password FROM app_users WHERE id=$1',[p.id])).rows[0];assert.ok(raw.password.startsWith('disabled:'))
})
await test('Aynı davet kabulü ikinci personel veya Meta yetkisi oluşturmaz',async()=>{
 await as('staff',()=>claim());assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_identities WHERE auth_user_id=$1',[ids.staff])).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM meta_members')).rows[0].n,1)
})
await test('İptal edilmiş davet kabul edilemez',async()=>{
 const item=await as('admin',()=>create('wrong@example.invalid'));await as('admin',()=>db.query('SELECT crm_revoke_staff_invite($1)',[item.id]));await as('wrong',()=>assert.rejects(claim(item.token),/crm_invite_invalid/))
})
await test('Kalıcılık kaydı sunucuda sürümlenir; aynı istek çoğalmaz',()=>as('staff',async()=>{
 const a=await save(req,0,'isolated persistence note'),b=await save(req,0,'isolated persistence note');assert.equal(Number(a.revision),1);assert.equal(Number(b.revision),1)
 await assert.rejects(save(req,0,'different'),/crm_request_conflict/)
 await assert.rejects(save('10000000-0000-0000-0000-000000000002',0,'stale'),/crm_revision_conflict/)
}))
await test('Başka kullanıcı notu okuyamaz veya tabloları doğrudan değiştiremez',()=>as('member',async()=>{
 assert.equal(await probe(),null);await assert.rejects(db.query('SELECT * FROM crm_backend.persistence_probes'));await assert.rejects(db.query('SELECT * FROM crm_backend.staff_invites'))
}))
await test('Veritabanı kapatılıp diskten yeniden açılınca kayıt korunur',async()=>{
 await db.close();db=new PGlite(directory)
 const row=await as('staff',probe);assert.equal(row.note,'isolated persistence note');assert.equal(Number(row.revision),1)
})
await test('Devre dışı kimlik eski JWT bağlamıyla bile notu okuyamaz',async()=>{
 await db.query('UPDATE crm_identities SET active=false WHERE auth_user_id=$1',[ids.staff]);await as('staff',()=>assert.rejects(probe(),/crm_identity_not_assigned/))
})
await db.exec("ALTER TABLE auth.users ADD COLUMN encrypted_password text; ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}'")
await db.exec(read('supabase/migrations/202611080003_crm_staff_accounts.sql'))
await db.exec(read('supabase/migrations/202611080004_crm_staff_management.sql'))
const staffRequest='20000000-0000-0000-0000-000000000001'
ids.newstaff='00000000-0000-0000-0000-000000000006'
const prepare=()=>db.query("SELECT crm_prepare_staff($1,'isolatedstaff','Isolated staff','Satış','MEMBER','ASSIGNED_ONLY') AS r",[staffRequest]).then(r=>r.rows[0].r)
let provisioning
await test('E-postasız personeli yalnızca yönetici hazırlayabilir; paralel işlem kilitlenir',async()=>{
 await as('member',()=>assert.rejects(prepare(),/crm_forbidden/))
 provisioning=await as('admin',prepare)
 await as('admin',()=>assert.rejects(prepare(),/crm_operation_processing/))
})
await test('Personel eşlemesi hizmet rolü gerektirir; geçici parola iş kayıtlarına yetki vermez',async()=>{
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password,raw_app_meta_data) VALUES($1,'isolatedstaff@staff.demirturk.invalid',now(),'isolated-hash',$2)",[ids.newstaff,JSON.stringify({crm_staff_request:staffRequest})])
 const finalize=()=>db.query('SELECT crm_finalize_staff($1,$2,$3,$4)',[ids.admin,staffRequest,ids.newstaff,provisioning.lease_id])
 await as('admin',()=>assert.rejects(finalize()))
 await as('admin',finalize,'service_role')
 await as('newstaff',async()=>{
  const p=(await db.query('SELECT crm_get_my_profile() AS r')).rows[0].r
  assert.equal(p.must_change_password,true)
  await assert.rejects(db.query('SELECT crm_finish_initial_password()'),/crm_password_change_required/)
 })
 assert.equal((await db.query('SELECT count(*)::int n FROM meta_members')).rows[0].n,1)
})
await test('Parola Auth üzerinde değişmeden ilk giriş kilidi kaldırılamaz; personel devre dışı bırakılabilir',async()=>{
 await db.query("UPDATE auth.users SET encrypted_password='isolated-new-hash' WHERE id=$1",[ids.newstaff])
 await as('newstaff',async()=>{
  await db.query('SELECT crm_finish_initial_password()')
  assert.equal((await db.query('SELECT crm_get_my_profile() AS r')).rows[0].r.must_change_password,false)
  await assert.rejects(db.query("SELECT crm_manage_staff($1,'{}',true)",['admin']),/crm_forbidden/)
 })
 await as('admin',async()=>{
  await assert.rejects(db.query("SELECT crm_manage_staff($1,$2,false)",['auth-'+ids.newstaff,JSON.stringify({role:'ADMIN',_revision:1})]),/crm_invalid_input/)
  await db.query('SELECT crm_manage_staff($1,$2,true)',['auth-'+ids.newstaff,JSON.stringify({_revision:1})])
 })
 await as('newstaff',()=>assert.rejects(db.query('SELECT crm_get_my_profile()'),/crm_identity_not_assigned/))
})
await db.exec(read('supabase/migrations/202611080008_crm_staff_reset.sql'))
await test('Personel parola sıfırlaması kilitli, denetimli ve hizmet rolüyle tamamlanır',async()=>{
 const req='30000000-0000-0000-0000-000000000001', target='auth-'+ids.newstaff
 await as('member',()=>assert.rejects(db.query('SELECT crm_staff_reset_target($1,$2)',[target,req]),/crm_forbidden/))
 const operation=await as('admin',()=>db.query('SELECT crm_staff_reset_target($1,$2) r',[target,req]).then(r=>r.rows[0].r))
 await as('newstaff',()=>assert.rejects(db.query('SELECT crm_finish_initial_password()'),/crm_reset_in_progress/))
 await as('admin',()=>assert.rejects(db.query('SELECT crm_staff_reset_target($1,$2)',[target,'30000000-0000-0000-0000-000000000002']),/crm_reset_in_progress/))
 await as('admin',()=>assert.rejects(db.query('SELECT crm_staff_reset_target($1)',[target])))
 const finish=()=>db.query('SELECT crm_finish_staff_reset($1,$2,$3,$4)',[ids.admin,ids.newstaff,req,operation.lease_id])
 await as('admin',()=>assert.rejects(finish()))
 await db.query("UPDATE auth.users SET encrypted_password='isolated-reset-hash' WHERE id=$1",[ids.newstaff])
 await as('admin',finish,'service_role')
 assert.equal((await db.query('SELECT must_change_password FROM app_users WHERE id=$1',[target])).rows[0].must_change_password,true)
 await as('admin',()=>assert.rejects(finish(),/crm_forbidden/),'service_role')
})
console.log(`CRM onboarding/kalıcılık SQL: ${passed}/${passed}. Disk yeniden açılışı izole testtir; gerçek Supabase tarayıcı testi ayrıca yapılır.`)
}finally{
 await db.close()
 const resolved=fs.realpathSync(directory),parent=fs.realpathSync(os.tmpdir())
 if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('portfoy-crm-test-'))throw Error('Güvensiz test temizleme yolu')
 fs.rmSync(resolved,{recursive:true,force:true})
}

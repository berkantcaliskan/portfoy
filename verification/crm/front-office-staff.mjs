import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),{PGlite}=require('@electric-sql/pglite')
const root=new URL('../../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8')
const db=new PGlite()
try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,encrypted_password text,raw_app_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT ON storage.objects TO authenticated;`)
 const schema=read('docs/supabase_schema.sql');await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
 await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
 await db.exec(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('00000000-0000-0000-0000-000000000001','isolated@example.invalid',now());
 INSERT INTO app_users(id,full_name,username,password,department,role,company_name,scope) VALUES('admin','İzole Yönetici','berkant','not-real','Yönetim','ADMIN','Company','ALL');
 INSERT INTO meta_members(auth_user_id,app_user_id,is_admin) VALUES('00000000-0000-0000-0000-000000000001','admin',true);`)
 for(const name of fs.readdirSync(new URL('supabase/migrations/',root)).sort().filter(name=>name>='202611040001'&&name<'20261116')) await db.exec(read('supabase/migrations/'+name))

 await db.exec(fs.readFileSync(new URL('../../outputs/Portfoy-Sunucu-Tamamlama.sql',root),'utf8'))
 await db.exec(fs.readFileSync(new URL('../../outputs/Portfoy-Ayarlar-ve-Personel.sql',root),'utf8'))
 const patch=read('supabase/migrations/20261117081541_front_office_staff.sql')
 await db.exec(patch);await db.exec(patch)
 await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
 const req='11000000-0000-0000-0000-000000000001',staff='22000000-0000-0000-0000-000000000001'
 const operation=(await db.query("SELECT crm_prepare_staff($1,'isolated-office','Isolated Office','Ön Ofis','REPRESENTATIVE','DEPARTMENT') r",[req])).rows[0].r
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,encrypted_password) VALUES($1,'isolated-office@staff.demirturk.invalid',now(),'isolated-hash')",[staff])
 await db.query("SELECT crm_finalize_staff('00000000-0000-0000-0000-000000000001',$1,$2,$3)",[req,staff,operation.lease_id])
 const row=(await db.query("SELECT * FROM app_users WHERE username='isolated-office'")).rows[0]
 assert.equal(row.department,'Ön Ofis');assert.deepEqual(row.departments,['Ön Ofis']);assert.equal(row.must_change_password,true)
 assert.equal((await db.query("SELECT count(*)::int n FROM crm_backend.office_access WHERE app_user_id=$1",[row.id])).rows[0].n,1)
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[staff])
 await assert.rejects(db.query('SELECT crm_office_context()'),/office_forbidden/)
 await db.query('UPDATE app_users SET must_change_password=false WHERE id=$1',[row.id])
 await db.exec('SET ROLE authenticated')
 const context=(await db.query('SELECT crm_office_context() r')).rows[0].r
 assert.equal(context.canAccess,true);assert.equal(context.isAdmin,false)
 const profile=(await db.query('SELECT crm_get_my_profile() r')).rows[0].r
 for(const module of ['payments','collections','google_ads_records','company_settings']){
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT crm_backend.can_access($1,$2,$3,'Muhasebe',true) r",[profile,module,row.id])).rows[0].r,false)
  await db.exec('SET ROLE authenticated')
 }
 await assert.rejects(db.query("SELECT crm_manage_staff('admin','{}',false)"),/crm_forbidden/)
 await db.exec('RESET ROLE')
 assert.equal((await db.query('SELECT count(*)::int n FROM meta_members')).rows[0].n,1)
 console.log('Ön Ofis: oluşturma, tekrar uygulama, ilk parola zorunluluğu, erişim, muhasebe/pazarlama/yönetim reddi ve eski kayıtların korunması geçti.')
} finally { await db.close() }

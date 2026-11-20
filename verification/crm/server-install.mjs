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
 const sql=fs.readFileSync(new URL('../../outputs/Portfoy-Sunucu-Tamamlama.sql',root),'utf8')
 await db.exec(sql)
 const status=(await db.query('SELECT crm_server_readiness() AS r')).rows[0].r
 assert.equal(status.ready,true);assert.deepEqual(status.missing,[])
 await db.exec("INSERT INTO crm_backend.office_records(id,company_name,kind,payload,revision,created_by) VALUES('95000000-0000-0000-0000-000000000001','Company','visitors','{\"name\":\"Kalıcı test kaydı\"}',1,'00000000-0000-0000-0000-000000000001')")
 await db.exec(sql)
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_backend.office_records')).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int n FROM meta_members')).rows[0].n,1)
 assert.equal((await db.query('SELECT crm_server_readiness() r')).rows[0].r.ready,true)
 const settings=fs.readFileSync(new URL('../../outputs/Portfoy-Ayarlar-ve-Personel.sql',root),'utf8')
 await db.exec(settings);await db.exec(settings)
 const upgraded=(await db.query('SELECT crm_server_readiness() r')).rows[0].r
 assert.equal(upgraded.version,20261116211611);assert.equal(upgraded.ready,true)
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_backend.office_records')).rows[0].n,1)
 await db.exec("UPDATE storage.buckets SET public=true WHERE id='crm-private';UPDATE crm_backend.module_settings SET write_enabled=false WHERE module='payments'")
 await assert.rejects(db.exec(sql),/Kurulum tamamlanmadı/)
 await db.exec('ROLLBACK')
 assert.equal((await db.query("SELECT write_enabled FROM crm_backend.module_settings WHERE module='payments'")).rows[0].write_enabled,false)
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_backend.office_records')).rows[0].n,1)
 console.log('Sunucu kurulum paketi: hazır olma, tekrar çalıştırma, mevcut kayıtları koruma ve hata durumunda tüm işlemi geri alma doğrulandı. Gerçek sunucuya uygulanmadı.')
} finally { await db.close() }

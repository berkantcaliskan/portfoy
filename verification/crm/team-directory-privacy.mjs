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

 const privacy=read('supabase/migrations/20261117091344_crm_team_directory_privacy.sql')
 await db.exec(privacy);await db.exec(privacy)
 const admin='00000000-0000-0000-0000-000000000001', member='00000000-0000-0000-0000-000000000009'
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'isolated@example.invalid',now())",[member])
 await db.exec("INSERT INTO app_users(id,full_name,username,password,department,departments,role,company_name,scope) VALUES('member','Hazal Çetin','hazal','unused','Satış','[\"Satış\",\"Kreatif\"]','REPRESENTATIVE','Company','DEPARTMENT'),('foreign','Foreign','foreign','unused','Satış','[]','MEMBER','Other Company','DEPARTMENT')")
 await db.query("INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,'member')",[member])
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin])
 await db.query("INSERT INTO crm_backend.records(module,id,company_name,owner_id,department,payload,revision) VALUES('team_presence','admin','Company','admin','Yönetim',$1,1)",[JSON.stringify({status:'OFISTE'})])
 for(const [uid,isAdmin] of [[member,false],[admin,true]]){
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid])
   await db.exec('SET ROLE authenticated')
   const roster=(await db.query('SELECT crm_staff_directory() result')).rows[0].result
   assert.deepEqual(roster.map(row=>row.username).sort(),['berkant','hazal'])
   const b=roster.find(row=>row.username==='berkant')
   const h=roster.find(row=>row.username==='hazal')
   assert.equal(b.department,isAdmin?'Yönetim':'Pazarlama')
   if(isAdmin) assert.deepEqual(h.departments,['Satış','Kreatif'])
   else assert.deepEqual(Object.keys(h).sort(),['avatarUrl','department','fullName','id','username'])
   const presence=(await db.query("SELECT crm_backend_list('team_presence') result")).rows[0].result
   assert.equal(presence.records.length,isAdmin?1:0)
   await db.exec('RESET ROLE')
   const profile=(await db.query('SELECT crm_get_my_profile() p')).rows[0].p
   for(const module of ['team_presence','team_assets','team_leaves']){
    const write=(await db.query('SELECT crm_backend.can_access($1,$2,$3,$4,true) allowed',[profile,module,'member','Satış'])).rows[0].allowed
    assert.equal(write,isAdmin)
   }
 }
 await db.query("UPDATE app_users SET must_change_password=true WHERE id='member'")
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member])
 assert.deepEqual((await db.query('SELECT crm_staff_directory() result')).rows[0].result,[])
 console.log('Ekip erişimi: aynı şirket listesi, Berkant Pazarlama etiketi, yetki alanlarının sansürlenmesi, üye için durum verisi okuma ve yazma engeli, ilk giriş ve admin erişimi doğrulandı.')
}finally{await db.close()}

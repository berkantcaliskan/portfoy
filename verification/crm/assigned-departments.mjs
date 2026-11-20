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

 const assignedPatch=read('supabase/migrations/20261117084621_assigned_department_read_access.sql')
 await db.exec(assignedPatch);await db.exec(assignedPatch)
 const users=[['hazal','Satış',['Satış','Kreatif'],'Company'],['ozlem','Muhasebe',['Muhasebe','Satış'],'Company'],['korhan','Kreatif',['Kreatif'],'Company'],['wrong','Muhasebe',['Muhasebe','Satış'],'Other Company']]
 for(let n=0;n<users.length;n++){
  const [id,dept,depts,company]=users[n],authId='33000000-0000-0000-0000-'+String(n+1).padStart(12,'0')
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[authId,id+'@example.invalid'])
  await db.query("INSERT INTO app_users(id,full_name,username,password,department,departments,role,company_name,scope) VALUES($1,$1,$1,'unused',$2,$3,'REPRESENTATIVE',$4,'DEPARTMENT')",[id,dept,JSON.stringify(depts),company])
  await db.query('INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)',[authId,id])
 }
 await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
 await db.exec("INSERT INTO leads(id,full_name,phone,assignment_history) VALUES('handed','Isolated handed','000','[{\"isSalesHandover\":true,\"assignedToUserId\":\"ALL_SALES\"}]'),('not-handed','Isolated hidden','000','[]')")
 for(const id of ['hazal','ozlem','korhan']){
  const p=(await db.query("SELECT jsonb_build_object('id',id,'role',role,'department',department,'departments',departments,'scope',scope,'permissions',permissions,'must_change_password',must_change_password) p FROM app_users WHERE id=$1",[id])).rows[0].p
  const creative=(await db.query("SELECT crm_backend.can_access($1,'creative_assets','another','Kreatif',false) r",[p])).rows[0].r
  assert.equal(creative,id!=='ozlem')
  if(id==='hazal')assert.equal((await db.query("SELECT crm_backend.can_access($1,'creative_assets','another','Kreatif',true) r",[p])).rows[0].r,false)
  assert.equal((await db.query("SELECT crm_backend.can_access($1,'payments','another','Muhasebe',false) r",[p])).rows[0].r,id==='ozlem')
 }
 for(let n=0;n<users.length;n++){
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",['33000000-0000-0000-0000-'+String(n+1).padStart(12,'0')])
  await db.exec('SET ROLE authenticated')
  const visible=(await db.query('SELECT id FROM leads ORDER BY id')).rows.map(row=>row.id)
  assert.deepEqual(visible,n<2?['handed']:[])
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT crm_backend.crm_can_access_lead('handed',true) r")).rows[0].r,false)
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM meta_members')).rows[0].n,1)
 console.log('İkincil departmanlar: Hazal kreatif okuyabilir/yazamaz, Özlem satışa iletilmiş müşterileri okuyabilir, iletilmemiş müşteri ve başka şirket reddedilir, atanmayana departman açılmaz; Meta üyelikleri korunur.')
}finally{await db.close()}

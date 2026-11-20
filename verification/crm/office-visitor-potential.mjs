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

 const readContext=async()=> (await db.query('SELECT crm_office_context() AS data')).rows[0].data
 await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
 assert.equal((await readContext()).visitorPotentialColors,undefined)
 const migration=read('supabase/migrations/20261117092336_crm_office_visitor_potential.sql')
 await db.exec(migration)
 await db.exec(migration)
 await db.exec('SET ROLE authenticated')
 assert.equal((await readContext()).visitorPotentialColors,true)
 const original={name:'İzole müşteri',phone:'00000000',notes:'Açıklama',status:'WAITING',visitedAt:'2026-11-17'}
 const record='11000000-0000-0000-0000-000000000011'
 let seq=0
 const save=(payload,revision,kind='visitors',id=record)=>db.query("SELECT crm_office_save($1,$2,$3,$4,$5) result",[
   '22000000-0000-0000-0000-'+String(++seq).padStart(12,'0'),id,kind,revision,JSON.stringify(payload)
 ]).then(r=>r.rows[0].result)
 assert.equal((await save(original,0)).payload.potential,undefined)
 for(const [index,potential] of ['green','yellow','red',''].entries()){
   const saved=await save({...original,potential},index+1)
   const listed=(await db.query("SELECT crm_office_list('visitors') result")).rows[0].result.records.find(row=>row.id===record)
   assert.equal(saved.revision,index+2)
   assert.equal(listed.payload.potential,potential)
   assert.equal(listed.payload.notes,original.notes)
 }
 await assert.rejects(save({...original,potential:'blue'},5),/office_invalid/)
 await assert.rejects(save({...original,potential:1},5),/office_invalid/)
 await assert.rejects(save({...original,potential:'red',status:'DRAFT',title:'İzole',beneficiary:'İzole',body:'İzole'},0,'contracts','11000000-0000-0000-0000-000000000012'),/office_invalid/)
 await assert.rejects(save({...original,potential:'red'},3),/office_conflict/)
 console.log('Potansiyel alanı: önceki kayıt, üç renk, temizleme, tekrar okuma, tür/değer kontrolü ve çakışma doğrulandı.')
}finally{await db.close()}

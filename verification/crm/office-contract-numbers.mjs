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
 const setup = read('supabase/migrations/20261117093559_crm_office_contract_numbers.sql')
 const year=(await db.query("SELECT extract(year FROM now() AT TIME ZONE 'Europe/Istanbul')::int AS year")).rows[0].year
 const id = n => '11000000-0000-0000-0000-'+String(n).padStart(12,'0')
 const requestId = n => '22000000-0000-0000-0000-'+String(n).padStart(12,'0')
 const original={name:'İzole müşteri',phone:'00000000',notes:'',status:'DRAFT',title:'İzole',beneficiary:'İzole',body:'İzole'}
 const save=(record,request,revision,payload=original)=>db.query("SELECT crm_office_save($1,$2,'contracts',$3,$4) result",[
   requestId(request),id(record),revision,JSON.stringify(payload)
 ]).then(r=>r.rows[0].result)
 await db.exec('SET ROLE authenticated')
 assert.equal((await save(3,31,0)).payload.contractNumber,undefined)
 await db.exec('RESET ROLE')
 await db.exec(setup)
 await db.exec(setup)
 await db.exec('SET ROLE authenticated')
 const first=await save(1,11,0)
 assert.equal(first.payload.contractNumber,'S/'+year+'000001')
 assert.deepEqual(await save(1,11,0),first)
 assert.equal((await save(1,12,1,{...original,notes:'Edit'})).payload.contractNumber,first.payload.contractNumber)
 await assert.rejects(save(4,41,2),/office_conflict/)
 const second=await save(2,21,0)
 assert.equal(second.payload.contractNumber,'S/'+year+'000002')
 assert.equal((await save(3,32,1)).payload.contractNumber,'S/'+year+'000003')
 const contracts=(await db.query("SELECT crm_office_list('contracts') result")).rows[0].result.records
 assert.equal(contracts.find(row=>row.id===id(1)).payload.contractNumber,first.payload.contractNumber)
 await db.exec('RESET ROLE')
 await db.query("INSERT INTO crm_backend.office_records(id,company_name,kind,payload,revision,created_by,created_at) VALUES($1,'Company','contracts',$2,1,auth.uid(),$3),($4,'Other Company','contracts',$2,1,auth.uid(),now())",
   [id(5),original,year+'-12-31T21:00:00Z',id(6)])
 const numbers=(await db.query("SELECT payload->>'contractNumber' AS number FROM crm_backend.office_records WHERE id IN ($1,$2) ORDER BY id",[id(5),id(6)])).rows
 assert.deepEqual(numbers.map(row=>row.number),['S/'+(year+1)+'000001','S/'+year+'000001'])
 await db.exec(setup)
 await db.exec('SET ROLE authenticated')
 assert.equal((await save(4,42,0)).payload.contractNumber,'S/'+year+'000004')
 console.log('Sözleşme sıra numarası: kayıt, yeniden deneme, düzenleme, eski kayıt, bağımsız şirket/yıl ve tekrar kurulum doğrulandı.')
}finally{await db.close()}


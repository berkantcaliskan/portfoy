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
 await db.exec(read('supabase/migrations/20261118065155_office_visitors_and_manual_lead_persistence.sql'))
 const ownershipMigration=read('supabase/migrations/20261118092029_representative_ownership_and_transfer.sql')
 const a='00000000-0000-0000-0000-000000000007',b='00000000-0000-0000-0000-000000000008',foreign='00000000-0000-0000-0000-000000000009'
 for(const [uid,id,company] of [[a,'rep-a','Company'],[b,'rep-b','Company'],[foreign,'foreign','Other Company']]){
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'qa@example.invalid',now())",[uid])
  await db.query("INSERT INTO app_users(id,full_name,username,password,department,role,scope,company_name) VALUES($1,$1,$1,'unused','Müşteri İlişkileri','REPRESENTATIVE','ALL',$2)",[id,company])
  await db.query('INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)',[uid,id])
 }
 await db.query("INSERT INTO meta_members(auth_user_id,app_user_id,is_admin,can_send) VALUES($1,'rep-a',true,true)",[a])
 await db.exec("INSERT INTO leads(id,full_name,phone,source,assigned_to_user_id,assigned_to_user_name) VALUES('own','İzole A','05000000000','META_ADS','rep-a','Temsilci A'),('others','İzole B','05000000001','DIRECT','rep-b','Temsilci B'),('unassigned','İzole atanmamış','05000000002','META_ADS',NULL,NULL)")
 await db.exec("INSERT INTO lead_activities(id,lead_id,type,content,author) VALUES('note-own','own','NOTE','İzole A','A'),('note-other','others','NOTE','İzole B','B')")
 await db.exec(ownershipMigration);await db.exec(ownershipMigration)
 assert.equal((await db.query("SELECT scope FROM app_users WHERE id='rep-a'")).rows[0].scope,'ASSIGNED_ONLY')
 // Even a broad stale scope and Meta membership must not widen representative reads.
 await db.exec("UPDATE app_users SET scope='ALL' WHERE id='rep-a'")
 await db.query("UPDATE meta_members SET is_admin=true WHERE auth_user_id=$1",[a])


 await db.exec("GRANT UPDATE ON leads TO authenticated")
 await db.exec("CREATE POLICY qa_broad_update ON leads FOR UPDATE TO authenticated USING(true) WITH CHECK(true)")
 const asUser=async(id,fn)=>{await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated');try{return await fn()}finally{await db.exec('RESET ROLE')}}
 let requestSeq=0
 const request=()=> '33000000-0000-0000-0000-'+String(++requestSeq).padStart(12,'0')
 const ids=async()=> (await db.query('SELECT id FROM leads ORDER BY id')).rows.map(row=>row.id)
 const transfer=(req,id,expected,target)=>db.query('SELECT crm_transfer_lead($1,$2,$3,$4) result',[req,id,expected,target]).then(row=>row.rows[0].result)
 const payload={fullName:'İzole manuel',phone:'05000000000',notes:'',stage:'NEW',callStatus:'WAITING',assignedToUserId:'rep-b',preferredHousingType:'2+1'}
 const original=(await db.query("SELECT updated_at,meta_revision,inquiries FROM leads WHERE id='own'")).rows[0]
 const transferRequest=request()
 await asUser(a,async()=>{
  assert.deepEqual(await ids(),['own'])
  assert.deepEqual((await db.query('SELECT id FROM lead_activities ORDER BY id')).rows.map(row=>row.id),['note-own'])
  await assert.rejects(db.query('SELECT crm_create_manual_lead($1,$2)',[request(),payload]),/crm_manual_lead_forbidden/)
  const manual=(await db.query('SELECT crm_create_manual_lead($1,$2) result',[request(),{...payload,assignedToUserId:''}])).rows[0].result
  assert.equal(manual.assigned_to_user_id,'rep-a')
  await assert.rejects(db.query("UPDATE leads SET assigned_to_user_id='rep-b' WHERE id='own'"),/crm_transfer_forbidden|row-level security/)
  await assert.rejects(transfer(request(),'others',original.updated_at,'rep-a'),/crm_transfer_invalid|crm_transfer_forbidden/)
  await assert.rejects(transfer(request(),'own',original.updated_at,'foreign'),/crm_transfer_invalid/)
  await assert.rejects(transfer(request(),'own','2000-01-01T00:00:00Z','rep-b'),/crm_transfer_conflict/)
  assert.equal((await transfer(transferRequest,'own',original.updated_at,'rep-b')).transferred,true)
  assert.equal((await transfer(transferRequest,'own',original.updated_at,'rep-b')).transferred,true)
  assert.equal((await ids()).includes('own'),false)
  assert.equal((await db.query("SELECT id FROM lead_activities WHERE lead_id='own'")).rows.length,0)
 })
 await asUser(b,async()=>assert.deepEqual(await ids(),['others','own']))
 await asUser(foreign,async()=>assert.deepEqual(await ids(),[]))
 const changed=(await db.query("SELECT assigned_to_user_id,meta_revision,inquiries,assignment_history FROM leads WHERE id='own'")).rows[0]
 assert.equal(changed.assigned_to_user_id,'rep-b');assert.equal(changed.meta_revision,original.meta_revision);assert.deepEqual(changed.inquiries,original.inquiries)
 assert.equal(changed.assignment_history.length,1)
 assert.equal((await db.query("SELECT count(*)::int n FROM lead_activities WHERE id LIKE 'transfer-%'")).rows[0].n,1)
 console.log('Temsilci erişimi doğrulandı: ALL kapsamı/Meta yetkisiyle bile yalnızca kendi müşterisi ve görüşmeleri, başlangıçta başka kişiye atama engeli, güvenli devir, tekrar deneme, şirket sınırı ve Meta kayıt sürümünün korunması.')
}finally{await db.close()}


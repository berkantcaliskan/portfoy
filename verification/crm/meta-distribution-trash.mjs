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
 // Include the deployed Auth rollout, which leaves policies calling the Meta helper.
 await db.exec(read('supabase/rollout/02_crm_rls_after_auth.sql'))

 const readContext=async()=> (await db.query('SELECT crm_office_context() AS data')).rows[0].data
 await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
 assert.equal((await readContext()).visitorPotentialColors,undefined)
 const migration=read('supabase/migrations/20261117092336_crm_office_visitor_potential.sql')
 await db.exec(migration)
 await db.exec(migration)
 await db.exec(read('supabase/migrations/20261118065155_office_visitors_and_manual_lead_persistence.sql'))
 const representatives=[['00000000-0000-0000-0000-000000000007','rep-a'],['00000000-0000-0000-0000-000000000008','rep-b'],['00000000-0000-0000-0000-000000000009','rep-c']]
 for(const [uid,id] of [...representatives,['00000000-0000-0000-0000-000000000006','marketer'],['00000000-0000-0000-0000-000000000005','foreign']]){
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'qa@example.invalid',now())",[uid])
  await db.query("INSERT INTO app_users(id,full_name,username,password,department,role,scope,company_name,created_at) VALUES($1,$1,$1,'unused',$2,'REPRESENTATIVE','ALL',$3,'2026-01-01')",[id,id==='marketer'?'Pazarlama':'Müşteri İlişkileri',id==='foreign'?'Other Company':'Company'])
  await db.query('INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)',[uid,id])
 }
 await db.exec(read('supabase/migrations/20261118092029_representative_ownership_and_transfer.sql'))
 const update=read('supabase/migrations/20261118102018_meta_intake_assignment_and_lead_trash.sql')
 await db.exec(update);await db.exec(update)
 const repair=read('supabase/migrations/20261119072528_crm_lead_policy_auth_repair.sql')
 await db.exec(repair);await db.exec(repair)
 const cutoff=read('supabase/migrations/20261119073630_meta_distribution_history_cutoff.sql')
 await db.exec(cutoff);await db.exec(cutoff)
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.meta_can_read_lead(uuid,text)','EXECUTE') granted")).rows[0].granted,false)
 const readiness=(await db.query('SELECT crm_meta_intake_readiness() result')).rows[0].result
 assert.equal(readiness.version,20261118102018)
 for(const [key,value] of Object.entries(readiness)) if(key!=='version') assert.equal(value,true,key)
 await db.exec("SELECT set_config('request.jwt.claim.sub','',false)")
 const ingest=async(n,createdAt='2026-11-18T10:00:00Z')=>{
  const p={leadgenId:String(200000+n),formId:'300000',formName:'QA form',fullName:'İzole '+n,phone:'90532'+String(n).padStart(7,'0'),createdAt,answers:[],fields:[],housingType:'2+1'}
  return (await db.query('SELECT meta_ingest_lead($1) id',[p])).rows[0].id
 }
 const assignee=async id=>(await db.query('SELECT assigned_to_user_id,updated_at,meta_revision,inquiries FROM leads WHERE id=$1',[id])).rows[0]
 const one=await ingest(1),two=await ingest(2),three=await ingest(3)
 assert.deepEqual(await Promise.all([one,two,three].map(async id=>(await assignee(id)).assigned_to_user_id)),['rep-a','rep-b','rep-c'])
 assert.equal((await ingest(1)),one)
 assert.equal((await db.query("SELECT turn FROM crm_backend.meta_distribution_state")).rows[0].turn,3)
 const four=await ingest(4)
 assert.equal((await assignee(four)).assigned_to_user_id,'rep-a')
 // A repeated customer form adds history, preserves its owner and consumes no turn.
 const duplicate={leadgenId:'999991',formId:'300000',formName:'QA form 2',fullName:'İzole 1',phone:'905320000001',createdAt:'2026-11-18T11:00:00Z',answers:[],fields:[]}
 assert.equal((await db.query('SELECT meta_ingest_lead($1) id',[duplicate])).rows[0].id,one)
 assert.equal((await assignee(one)).inquiries.length,2)
 assert.equal((await db.query("SELECT turn FROM crm_backend.meta_distribution_state")).rows[0].turn,4)
 const addRep=async(uid,id)=>{
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'qa@example.invalid',now())",[uid])
  await db.query("INSERT INTO app_users(id,full_name,username,password,department,role,scope,company_name) VALUES($1,$1,$1,'unused','Müşteri İlişkileri','REPRESENTATIVE','ASSIGNED_ONLY','Company')",[id])
  await db.query("INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)",[uid,id])
 }
 const newRep='00000000-0000-0000-0000-000000000004'
 await addRep(newRep,'rep-d')
 const five=await ingest(5)
 assert.equal((await assignee(five)).assigned_to_user_id,'rep-d')
 await db.exec("UPDATE crm_identities SET active=false WHERE app_user_id='rep-b'")
 const six=await ingest(6)
 assert.equal((await assignee(six)).assigned_to_user_id,'rep-c')
 assert.equal((await db.query('SELECT meta_can_read_lead($1,$2) allowed',[representatives[0][0],one])).rows[0].allowed,true)
 assert.equal((await db.query('SELECT meta_can_read_lead($1,$2) allowed',[representatives[0][0],three])).rows[0].allowed,false)
 assert.equal((await db.query('SELECT is_admin FROM meta_members WHERE auth_user_id=$1',[representatives[0][0]])).rows[0].is_admin,false)
 const asUser=async(uid,work)=>{await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('SET ROLE authenticated');try{return await work()}finally{await db.exec('RESET ROLE')}}
 let seq=0
 const request=()=> '55000000-0000-0000-0000-'+String(++seq).padStart(12,'0')
 await asUser(representatives[0][0],async()=>{
  const ids=(await db.query('SELECT id FROM leads ORDER BY id')).rows.map(row=>row.id)
  assert.deepEqual(ids,[one,four].sort())
  const record=await assignee(one)
  const req=request()
  const change={stage:'QUALIFIED',isQualified:true,callStatus:'INFO_GIVEN',notes:'Bilgi verildi.'}
  const run=()=>db.query('SELECT crm_update_lead_work($1,$2,$3,$4) result',[req,one,record.updated_at,change]).then(r=>r.rows[0].result)
  let saved=await run()
  assert.equal(saved.stage,'QUALIFIED');assert.equal(saved.call_status,'INFO_GIVEN')
  assert.equal(saved.meta_revision,record.meta_revision+1)
  assert.deepEqual(await run(),saved)
  const handoverRequest=request(),beforeHandover=saved
  const handover=()=>db.query('SELECT crm_update_lead_work($1,$2,$3,$4) result',[handoverRequest,one,beforeHandover.updated_at,{salesTarget:'ALL_SALES',salesNote:'Görüşme hazır.'}]).then(r=>r.rows[0].result)
  saved=await handover()
  assert.equal(saved.assigned_to_user_id,'rep-a')
  assert.equal(saved.assignment_history[0].isSalesHandover,true)
  assert.equal(saved.assignment_history[0].assignedToUserId,'ALL_SALES')
  assert.deepEqual(await handover(),saved)
  await assert.rejects(db.query('SELECT crm_update_lead_work($1,$2,$3,$4)',[request(),one,saved.updated_at,{salesTarget:'rep-c'}]),/crm_invalid_consultant/)
  await assert.rejects(db.query('SELECT crm_update_lead_work($1,$2,$3,$4)',[request(),three,record.updated_at,change]),/crm_lead_forbidden/)
  const archiveRequest=request()
  const toArchive=[{id:one,expected:saved.updated_at},{id:four,expected:(await assignee(four)).updated_at}]
  const archive=()=>db.query('SELECT crm_archive_leads($1,$2) result',[archiveRequest,toArchive]).then(r=>r.rows[0].result)
  assert.equal((await archive()).archived,true);assert.equal((await archive()).ids.length,2)
  assert.equal((await db.query('SELECT id FROM leads')).rows.length,0)
  const trash=(await db.query('SELECT crm_lead_trash_list() result')).rows[0].result
  assert.equal(trash.records.length,2)
  assert.equal((await db.query('SELECT id FROM lead_activities')).rows.length,0)
  await assert.rejects(db.query('DELETE FROM crm_backend.lead_archives'),/permission denied/)
  await assert.rejects(db.query('DELETE FROM leads'),/permission denied/)
  await assert.rejects(db.query('SELECT crm_archive_leads($1,$2)',[request(),[{id:three,expected:saved.updated_at}]]),/crm_archive_forbidden/)
  const restoreReq=request()
  const restore=()=>db.query('SELECT crm_restore_lead($1,$2) result',[restoreReq,one]).then(r=>r.rows[0].result)
  assert.equal((await restore()).restored,true);assert.equal((await restore()).restored,true)
  assert.equal((await db.query('SELECT id FROM leads')).rows.length,1)
 })
 await asUser(representatives[2][0],async()=>{
  const ids=(await db.query('SELECT id FROM leads ORDER BY id')).rows.map(row=>row.id)
  assert.deepEqual(ids,[three,six].sort())
  assert.equal((await db.query('SELECT crm_lead_trash_list() result')).rows[0].result.records.length,0)
  await assert.rejects(db.query('SELECT crm_restore_lead($1,$2)',[request(),four]),/crm_archive_forbidden/)
 })
 await asUser('00000000-0000-0000-0000-000000000006',async()=>{
  assert.equal((await db.query('SELECT id FROM leads')).rows.length,5)
 })
 await asUser('00000000-0000-0000-0000-000000000005',async()=>{
  assert.equal((await db.query('SELECT id FROM leads')).rows.length,0)
  assert.equal((await db.query('SELECT crm_lead_trash_list() result')).rows[0].result.records.length,0)
 })
 await db.exec("SELECT set_config('request.jwt.claim.sub','',false)")
 for(const [uid,id] of representatives) await db.query('UPDATE crm_identities SET active=false WHERE auth_user_id=$1',[uid])
 await db.query('UPDATE crm_identities SET active=false WHERE auth_user_id=$1',[newRep])
 const before=(await db.query('SELECT turn FROM crm_backend.meta_distribution_state')).rows[0].turn
 const waiting=await ingest(7)
 assert.equal((await assignee(waiting)).assigned_to_user_id,null)
 assert.equal((await db.query('SELECT turn FROM crm_backend.meta_distribution_state')).rows[0].turn,before)
 await db.exec("UPDATE crm_identities SET active=true WHERE app_user_id='rep-a'")
 await asUser('00000000-0000-0000-0000-000000000001',async()=>{
  assert.equal((await db.query('SELECT crm_assign_pending_meta_leads() count')).rows[0].count,1)
 })
 assert.equal((await assignee(waiting)).assigned_to_user_id,'rep-a')
 assert.equal((await db.query("SELECT count(*)::int n FROM crm_backend.lead_archives")).rows[0].n,1)
 await db.exec("SELECT set_config('request.jwt.claim.sub','',false)")
 const cursorBefore=(await db.query('SELECT turn FROM crm_backend.meta_distribution_state')).rows[0].turn
 const historical=await ingest(8,'2026-11-17T20:59:59.999Z')
 assert.equal((await assignee(historical)).assigned_to_user_id,null)
 assert.equal((await db.query('SELECT turn FROM crm_backend.meta_distribution_state')).rows[0].turn,cursorBefore)
 await asUser('00000000-0000-0000-0000-000000000001',async()=>{
  assert.equal((await db.query('SELECT crm_assign_pending_meta_leads() count')).rows[0].count,0)
  const policy=(await db.query('SELECT crm_meta_distribution_policy() result')).rows[0].result
  assert.equal(policy.assignment_from,'2026-11-17T21:00:00+00:00')
 })
 assert.equal((await assignee(historical)).assigned_to_user_id,null)
 await db.exec("SELECT set_config('request.jwt.claim.sub','',false)")
 const boundary=await ingest(9,'2026-11-17T21:00:00.000Z')
 assert.equal((await assignee(boundary)).assigned_to_user_id,'rep-a')
 const repeat={leadgenId:'999999',formId:'300000',formName:'QA new inquiry',fullName:'İzole 8',phone:'90532'+String(8).padStart(7,'0'),createdAt:'2026-11-19T10:00:00Z',fields:[]}
 const resubmitted=(await db.query('SELECT meta_ingest_lead($1) id',[repeat])).rows[0].id
 assert.equal(resubmitted,historical)
 assert.equal((await assignee(historical)).assigned_to_user_id,'rep-a')
 console.log('Meta sunucu testleri geçti: kalıcı sıra, tekil/toplu geliş, yinelenen olay ve müşteri, yeni/ayrılan temsilci, boş ekip, bekleyen dağıtımı; kişisel/pazarlama/şirket sınırı; aşama ve yeniden deneme; toplu çöp kutusu, geri yükleme ve kalıcı silme engeli.')
}finally{await db.close()}

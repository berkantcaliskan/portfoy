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
 const update=read('supabase/migrations/20261118065155_office_visitors_and_manual_lead_persistence.sql').replace(/^\uFEFF/,'')
 await db.exec(read('supabase/migrations/20261117091344_crm_team_directory_privacy.sql'))
 await db.exec(update);await db.exec(update)
 const member='00000000-0000-0000-0000-000000000009'
 const other='00000000-0000-0000-0000-000000000008'
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'isolated@example.invalid',now()),($2,'outside@example.invalid',now())",[member,other])
 await db.exec("INSERT INTO app_users(id,full_name,username,password,department,role,company_name,scope) VALUES('member','İzole Personel','qa','unused','Müşteri İlişkileri','REPRESENTATIVE','Company','ASSIGNED_ONLY'),('other','Dış Personel','outside','unused','Müşteri İlişkileri','REPRESENTATIVE','Other Company','ALL')")
 await db.query("INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,'member'),($2,'other')",[member,other])
 await db.exec("INSERT INTO crm_backend.office_access(app_user_id,granted_by) VALUES('member','00000000-0000-0000-0000-000000000001')")
 let sequence=0
 const uuid=()=> '22000000-0000-0000-0000-'+String(++sequence).padStart(12,'0')
 const record=uuid()
 const visitor={name:'İzole müşteri',phone:'05000000000',notes:'Not',status:'WAITING',visitedAt:'2026-11-18',source:'Hepsiemlak',staffIds:['member','admin'],representativeIds:['admin','member'],potential:'green'}
 const save=(payload,revision,id=record)=>db.query("SELECT crm_office_save($1,$2,'visitors',$3,$4) result",[uuid(),id,revision,payload]).then(r=>r.rows[0].result)
 const remove=(request,revision)=>db.query('SELECT crm_office_delete_visitor($1,$2,$3) result',[request,record,revision]).then(r=>r.rows[0].result)
 const leadPayload={fullName:'İzole kalıcı müşteri',phone:'05000000000',notes:'İlk not',stage:'NEW',callStatus:'CALLED',assignedToUserId:'',preferredHousingType:'2+1 Konut'}
 const create=(request,payload=leadPayload)=>db.query('SELECT crm_create_manual_lead($1,$2) result',[request,payload]).then(r=>r.rows[0].result)
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member]);await db.exec('SET ROLE authenticated')
 assert.equal((await db.query('SELECT crm_office_context() result')).rows[0].result.visitorDetails,true)
 const ownPresence=(await db.query("SELECT crm_backend_write($1,'team_presence','member',0,$2,false) result",
  [uuid(),{id:'member',userId:'member',status:'TAPUDA',locationNote:'İzole konum',returnTime:'15:00'}])).rows[0].result
 assert.equal(ownPresence.id,'member')
 assert.equal((await db.query("SELECT crm_backend_list('team_presence') result")).rows[0].result.records[0].payload.locationNote,'İzole konum')
 await assert.rejects(db.query("SELECT crm_backend_write($1,'team_presence','admin',0,$2,false) result",
  [uuid(),{id:'admin',userId:'admin',status:'TAPUDA'}]),/crm_forbidden/)
 assert.deepEqual((await save(visitor,0)).payload,visitor)
 assert.deepEqual((await db.query("SELECT crm_office_list('visitors') result")).rows[0].result.records[0].payload,visitor)
 await assert.rejects(save({...visitor,source:'Other'},1),/office_invalid/)
 await assert.rejects(save({...visitor,staffIds:['other']},1),/office_invalid/)
 await assert.rejects(save({...visitor,representativeIds:[2]},1),/office_invalid/)
 const legacy={name:'Eski ziyaret',phone:'05000000000',notes:'',status:'WAITING',visitedAt:'2026-11-18',staffId:'member',representativeId:'admin'}
 assert.equal((await save(legacy,0,uuid())).payload.staffId,'member')
 const deletion=uuid()
 assert.equal((await remove(deletion,1)).deleted,true)
 assert.equal((await remove(deletion,1)).deleted,true)
 assert.equal((await db.query("SELECT crm_office_list('visitors') result")).rows[0].result.records.some(row=>row.id===record),false)
 await assert.rejects(save(visitor,2),/office_deleted/)
 const request=uuid()
 const created=await create(request)
 assert.equal(created.assigned_to_user_id,'member')
 assert.equal(created.source,'DIRECT')
 assert.equal(created.call_status,'CALLED')
 assert.equal(created.stage,'NEW')
 assert.deepEqual(await create(request),created)
 await assert.rejects(create(request,{...leadPayload,notes:'Changed'}),/crm_manual_lead_conflict/)
 assert.equal((await db.query('SELECT id FROM leads WHERE id=$1',[created.id])).rows.length,1)
 assert.equal((await db.query('SELECT id FROM lead_activities WHERE lead_id=$1',[created.id])).rows.length,1)
 await assert.rejects(create(uuid(),{...leadPayload,assignedToUserId:'other'}),/crm_manual_lead_invalid/)
 const profile=(await db.query('SELECT crm_get_my_profile() p')).rows[0].p
 await db.exec('RESET ROLE')
 await db.query("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
 await db.query("INSERT INTO crm_backend.records(module,id,company_name,owner_id,department,payload,revision) VALUES('team_assets','qa-asset','Company','admin','Yönetim',$1,1)",
  [{id:'qa-asset',name:'İzole araç',codeOrPlate:'QA',category:'ARAC',holderUserId:null,holderUserName:null,notes:'Yalnızca yönetici',history:[]}])
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member])
 await db.exec('SET ROLE authenticated')
 const locations=(await db.query('SELECT crm_team_asset_locations() result')).rows[0].result
 assert.equal(locations[0].name,'İzole araç')
 assert.equal(locations[0].notes,undefined)
 assert.equal(locations[0].history,undefined)
 await db.exec('RESET ROLE')
 for(const [module,owner,writing,expected] of [['team_presence','member',true,true],['team_presence','admin',true,false],['team_presence','admin',false,true],['team_assets','admin',true,false],['team_assets','admin',false,false],['team_leaves','member',true,false]]){
   assert.equal((await db.query('SELECT crm_backend.can_access($1,$2,$3,$4,$5) allowed',[profile,module,owner,'Müşteri İlişkileri',writing])).rows[0].allowed,expected)
 }
 assert.equal((await db.query('SELECT payload->>\'name\' AS name FROM crm_backend.office_records WHERE id=$1 AND deleted_at IS NOT NULL',[record])).rows[0].name,visitor.name)
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('SET ROLE authenticated')
 assert.equal((await db.query('SELECT id FROM leads WHERE id=$1',[created.id])).rows.length,0)
 await assert.rejects(create(uuid()),/crm_manual_lead_forbidden/)
 await db.exec('RESET ROLE')
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member])
 await db.query("UPDATE app_users SET must_change_password=true WHERE id='member'")
 await assert.rejects(create(uuid()),/crm_manual_lead_forbidden/)
 console.log('Sunucu doğrulandı: çoklu personel, kaynak, eski kayıt, kalıcı silme işareti, silinenin geri yazılma engeli; manuel müşterinin sunucuya kaydı/tekrar okuması, tek kayıtla yeniden deneme; şirket ve personel yetkileri.')
}finally{await db.close()}


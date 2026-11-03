import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
const root=new URL('../../',import.meta.url)
const read=p=>fs.readFileSync(new URL(p,root),'utf8')
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
const schema=read('docs/supabase_schema.sql')
await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
console.log('Migration izole PostgreSQL motorunda uygulandı.')
const intake={leadgenId:'456',fullName:'İzole Test',phone:'05321234567',createdAt:'2026-10-31T00:00:00Z',formName:'Test Form',fields:[],answers:[]}
const ingest=async p=>(await db.query('SELECT meta_ingest_lead($1::jsonb) AS id',[JSON.stringify(p)])).rows[0].id
let passed=0
async function test(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}
await test('Migration tekrar uygulanabilir',()=>db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql')))
await test('Yeni müşteri oluşturulur',async()=>{assert.equal(await ingest(intake),'lead-meta-456');assert.equal((await db.query('select count(*)::int AS n from leads')).rows[0].n,1)})
await test('Tekrarlanan webhook müşteri/başvuru/aktiviteyi çoğaltmaz',async()=>{await ingest(intake);assert.equal((await db.query('select jsonb_array_length(inquiries) AS n from leads')).rows[0].n,1);assert.equal((await db.query('select count(*)::int AS n from lead_activities')).rows[0].n,1)})
await test('Aynı normalize telefon yeni başvuru geçmişine eklenir',async()=>{await ingest({...intake,leadgenId:'457',phone:'+905321234567'});assert.equal((await db.query('select count(*)::int AS n from leads')).rows[0].n,1);assert.equal((await db.query('select jsonb_array_length(inquiries) AS n from leads')).rows[0].n,2)})
await test('İlk on kayıt sınırı yok: on ikinci kayıt eşleşir',async()=>{for(let i=0;i<12;i++)await ingest({...intake,leadgenId:String(600+i),phone:'90533'+String(i).padStart(7,'0')});const before=(await db.query('select count(*)::int AS n from leads')).rows[0].n;await ingest({...intake,leadgenId:'700',phone:'05330000011'});assert.equal((await db.query('select count(*)::int AS n from leads')).rows[0].n,before)})
await test('Telefon yoksa iki ayrı kişi birleştirilmez',async()=>{const a=await ingest({...intake,leadgenId:'800',phone:''});const b=await ingest({...intake,leadgenId:'801',phone:''});assert.notEqual(a,b)})
await test('İşlem ortasında DB hatası tüm yazımları geri alır',async()=>{await db.exec("CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated-failure'; END $$; CREATE TRIGGER test_fail BEFORE INSERT ON lead_activities FOR EACH ROW EXECUTE FUNCTION test_fail();");await assert.rejects(ingest({...intake,leadgenId:'900',phone:''}));assert.equal((await db.query("select count(*)::int AS n from leads where id='lead-meta-900'")).rows[0].n,0);assert.equal((await db.query("select count(*)::int AS n from meta_lead_events where leadgen_id='900'")).rows[0].n,0);await db.exec('DROP TRIGGER test_fail ON lead_activities')})
const admin='00000000-0000-0000-0000-000000000001'
await db.query('insert into auth.users values($1)',[admin])
await db.query('insert into meta_members(auth_user_id,is_admin) values($1,true)',[admin])
const enqueue=async(testMode=false)=>(await db.query('select meta_enqueue($1,$2,$3) AS id',[admin,'lead-meta-456',testMode])).rows[0].id
await test('Devre dışı entegrasyon göndermez',async()=>assert.rejects(enqueue()))
await db.exec("UPDATE meta_settings SET enabled=true,security_ready=true,enabled_at=now()-interval '1 second'")
await test('Geçmiş müşteri toplu gönderimi engellenir',async()=>assert.rejects(enqueue()))
await db.exec("UPDATE leads SET stage='QUALIFIED',is_qualified=true WHERE id='lead-meta-456'")
let eid
await test('Gerçek stage revision ile kalıcı olay oluşur',async()=>{eid=await enqueue();assert.ok(eid)})
await test('Aynı revision tekrarı tek olaydır',async()=>assert.equal(await enqueue(),eid))
await test('Yetkisiz kullanıcı enqueue edemez',async()=>assert.rejects(db.query('select meta_enqueue($1,$2,false)',['00000000-0000-0000-0000-000000000002','lead-meta-456'])))
let job
await test('Kuyruk lease ile yalnızca bir defa alınır',async()=>{job=(await db.query('select * from meta_claim($1)',[eid])).rows[0];assert.equal(job.attempt,1);assert.equal((await db.query('select * from meta_claim($1)',[eid])).rows.length,0)})
await test('Yanlış lease sonucu kaydedemez',async()=>assert.rejects(db.query('select meta_finish($1,$2,$3::jsonb)',[eid,admin,JSON.stringify({state:'sent',received:1})])))
await test('Retry sonucu ve deneme geçmişi atomik kaydedilir',async()=>{await db.query('select meta_finish($1,$2,$3::jsonb)',[eid,job.lease_id,JSON.stringify({state:'retry',received:0,httpStatus:503,retrySeconds:30})]);assert.equal((await db.query('select state from meta_outbox where id=$1',[eid])).rows[0].state,'retry');assert.equal((await db.query('select count(*)::int AS n from meta_attempts')).rows[0].n,1)})
await test('Backoff dolmadan tekrar alınmaz',async()=>assert.equal((await db.query('select * from meta_claim($1)',[eid])).rows.length,0))
await test('Test ve canlı olay birbirini tekilleştirmez',async()=>assert.notEqual(await enqueue(true),eid))
await test('Purchase kuyruğu oluşturulmaz',async()=>{await db.exec("UPDATE leads SET stage='WON' WHERE id='lead-meta-456'");await assert.rejects(enqueue())})
await test('Aşama güncellemesi doğrulanmış kullanıcı ve revision ile yapılır',async()=>{const rev=(await db.query("select meta_revision from leads where id='lead-meta-456'")).rows[0].meta_revision;const r=(await db.query('select meta_set_stage($1,$2,$3,$4,$5) AS lead',[admin,'lead-meta-456',rev,'QUALIFIED',true])).rows[0].lead;assert.equal(r.stage,'QUALIFIED');assert.equal((await db.query('select actor from meta_stage_audit order by id desc limit 1')).rows[0].actor,admin)})
await test('Eski revision güncel CRM aşamasını ezemez',async()=>assert.rejects(db.query('select meta_set_stage($1,$2,$3,$4,$5)',[admin,'lead-meta-456',0,'LOST',false])))
await test('Aşama değişikliği Meta gönderim kaydı oluşturmaz',async()=>{const before=(await db.query('select count(*)::int AS n from meta_outbox')).rows[0].n;const rev=(await db.query("select meta_revision from leads where id='lead-meta-456'")).rows[0].meta_revision;await db.query('select meta_set_stage($1,$2,$3,$4,$5)',[admin,'lead-meta-456',rev,'CONTACTED',false]);assert.equal((await db.query('select count(*)::int AS n from meta_outbox')).rows[0].n,before)})
await test('Demo otomatik gönderim bayrağı DB seviyesinde açılamaz',async()=>{await assert.rejects(db.exec('update meta_settings set auto_sync=true'));assert.equal((await db.query('select auto_sync from meta_settings')).rows[0].auto_sync,false)})
await test('Süresi dolan beşinci lease sonsuza kadar processing kalmaz',async()=>{await db.query("update meta_outbox set state='processing',attempt=5,lease_until=now()-interval '1 minute' where id=$1",[eid]);await db.query('select * from meta_claim($1)',[eid]);assert.equal((await db.query('select state from meta_outbox where id=$1',[eid])).rows[0].state,'rejected')})
await test('RLS geçişi Auth/personel eşlemesi olmadan durur',async()=>assert.rejects(db.exec(read('supabase/rollout/02_crm_rls_after_auth.sql'))))
await db.exec('ROLLBACK')
await db.exec("INSERT INTO app_users(id,full_name,username,password,department,role) VALUES('test-admin','İzole Yönetici','isolated','unused','Yönetim','ADMIN')")
await db.query("UPDATE meta_members SET app_user_id='test-admin' WHERE auth_user_id=$1",[admin])
await db.exec('GRANT USAGE ON SCHEMA auth TO authenticated;')
await test('RLS geçişi eşleştirilmiş yöneticiyle uygulanır',()=>db.exec(read('supabase/rollout/02_crm_rls_after_auth.sql')))
await test('Anonim kullanıcı müşteri okuyamaz',async()=>{await db.exec('SET ROLE anon');try { await assert.rejects(db.query('SELECT * FROM leads')) } finally { await db.exec('RESET ROLE') }})
await test('Anonim kullanıcı ayrıcalıklı ingestion RPC çağıramaz',async()=>{await db.exec('SET ROLE anon');try { await assert.rejects(ingest({...intake,leadgenId:'999'})) } finally { await db.exec('RESET ROLE') }})
await test('Eşlemesi olmayan Auth kullanıcısı müşteri okuyamaz',async()=>{await db.exec("SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'");try { assert.equal((await db.query('SELECT * FROM leads')).rows.length,0) } finally { await db.exec('RESET ROLE; RESET request.jwt.claim.sub') }})
await test('Yetkili yönetici müşteri okuyabilir; parola okuyamaz',async()=>{await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${admin}'`);try { assert.ok((await db.query('SELECT * FROM leads')).rows.length>0);await assert.rejects(db.query('SELECT password FROM app_users')) } finally { await db.exec('RESET ROLE; RESET request.jwt.claim.sub') }})

await test('İstemciden gelen Meta kimliği canonical atıf olarak kullanılmaz',async()=>{
  await db.exec("UPDATE leads SET meta_lead_id='999999999999999',inquiries='[]' WHERE id='lead-meta-456'")
  const id=await enqueue()
  const snapshot=(await db.query('select snapshot from meta_outbox where id=$1',[id])).rows[0].snapshot
  assert.ok(['456','457'].includes(snapshot.meta_lead_id));assert.notEqual(snapshot.meta_lead_id,'999999999999999')
})
await test('Manual enqueue istenen revision ve olay adıyla uyuşmalıdır',async()=>{
  const rev=(await db.query("select meta_revision from leads where id='lead-meta-456'")).rows[0].meta_revision
  await assert.rejects(db.query('select meta_enqueue_checked($1,$2,false,$3,$4)',[admin,'lead-meta-456',rev,'QualifiedLead']))
  await assert.rejects(db.query('select meta_enqueue_checked($1,$2,false,$3,$4)',[admin,'lead-meta-456',0,'Contact']))
})
const staff='00000000-0000-0000-0000-000000000003'
await db.query('insert into auth.users values($1)',[staff])
await db.exec("INSERT INTO app_users(id,full_name,username,password,department,role,scope) VALUES('test-staff','İzole Personel','isolated-staff','unused','Satış','STAFF','ASSIGNED_ONLY')")
await db.query("INSERT INTO meta_members(auth_user_id,app_user_id,can_send) VALUES($1,'test-staff',true)",[staff])
await db.exec("UPDATE leads SET assigned_to_user_id='test-staff' WHERE id='lead-meta-456'")
async function asStaff(fn){await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[staff]);try{await fn()}finally{await db.exec('RESET ROLE; RESET request.jwt.claim.sub')}}
await test('Gönderim yetkili personel Meta kimliğini değiştiremez',()=>asStaff(async()=>assert.rejects(db.query("UPDATE leads SET meta_lead_id='12345' WHERE id='lead-meta-456'"))))
await test('Gönderim yetkili personel inquiry atfını değiştiremez',()=>asStaff(async()=>assert.rejects(db.query("UPDATE leads SET inquiries='[]' WHERE id='lead-meta-456'"))))
await test('Aşama doğrudan tablo UPDATE ile yetkili RPC dışından değiştirilemez',()=>asStaff(async()=>assert.rejects(db.query("UPDATE leads SET stage='QUALIFIED' WHERE id='lead-meta-456'"))))
await test('Atanmış müşteri iletişim alanı güncellemesi korunur',()=>asStaff(async()=>{const r=await db.query("UPDATE leads SET notes='İzole test notu' WHERE id='lead-meta-456' RETURNING id");assert.equal(r.rows.length,1)}))
await test('Başka müşterinin kayıtları atanmış-only personeline kapalı kalır',()=>asStaff(async()=>{assert.equal((await db.query("SELECT id FROM leads WHERE id='lead-meta-800'")).rows.length,0)}))
await test('Sahte eski inquiry ID gerçek webhook müşterisini başka kişiye bağlayamaz',async()=>{
  await db.exec("INSERT INTO leads(id,full_name,phone,meta_lead_id,inquiries) VALUES('forged-local','İzole Eski Kayıt','','887788','[{\"metaLeadgenId\":\"887788\"}]')")
  const id=await ingest({...intake,leadgenId:'887788',phone:'905341234567'})
  assert.notEqual(id,'forged-local')
})
await test('Üretim kapalı test-only claim canlı pending olayı almaz',async()=>{
  await db.exec('UPDATE meta_settings SET enabled=false')
  const rev=(await db.query("select meta_revision from leads where id='lead-meta-456'")).rows[0].meta_revision
  const testId=(await db.query('select meta_enqueue_checked($1,$2,true,$3,$4) AS id',[admin,'lead-meta-456',rev,'Contact'])).rows[0].id
  const result=await db.query('select * from meta_claim($1,true)',[testId])
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].test_mode,true)
  const live=await db.query('select * from meta_claim($1,true)',[eid]);assert.equal(live.rows.length,0)
  await db.exec('UPDATE meta_settings SET enabled=true')
})
await test('Otuz üzeri aşama değişikliği CRM transactionını hız sınırıyla geri almaz',async()=>{
  const before=(await db.query('select count(*)::int AS n from meta_outbox')).rows[0].n
  const ids=[]
  for(let i=0;i<35;i++){
    const id=await ingest({...intake,leadgenId:String(990000+i),phone:''})
    await db.query('select meta_set_stage($1,$2,0,$3,false)',[admin,id,'CONTACTED']);ids.push(id)
  }
  assert.equal((await db.query('select count(*)::int AS n from meta_outbox')).rows[0].n,before)
  for(const id of ids) await db.query('select meta_enqueue($1,$2,false)',[admin,id])
  assert.equal((await db.query('select count(*)::int AS n from meta_outbox')).rows[0].n,before+35)
  assert.equal((await db.query("select stage from leads where id='lead-meta-990034'")).rows[0].stage,'CONTACTED')
})
await test('Teslim hız sınırı dolduğunda müşteri aşaması ve pending olay korunur',async()=>{
  await db.exec("INSERT INTO meta_attempts(event_id,attempt,started_at,state) SELECT id,1,now(),'sent' FROM meta_outbox LIMIT 30 ON CONFLICT DO NOTHING")
  const before=(await db.query("select count(*)::int AS n from meta_attempts where started_at>now()-interval '1 minute'")).rows[0].n
  assert.ok(before>=30)
  const target=(await db.query("select id from meta_outbox where lead_id='lead-meta-990034'")).rows[0].id;const result=await db.query('select * from meta_claim($1,false)',[target]);assert.equal(result.rows.length,0)
  assert.equal((await db.query("select stage from leads where id='lead-meta-990034'")).rows[0].stage,'CONTACTED')
  assert.equal((await db.query("select state from meta_outbox where lead_id='lead-meta-990034'")).rows[0].state,'pending')
})

await test('Belirli olay seçilmeden background claim hiçbir kayıt alamaz',async()=>{
  assert.equal((await db.query('select * from meta_claim(null,false)')).rows.length,0)
  assert.equal((await db.query("select count(*)::int AS n from pg_trigger where tgname='meta_auto_enqueue' AND NOT tgisinternal")).rows[0].n,0)
})
await test('Elle retry aynı event ID ve payload ile devam eder',async()=>{
  const row=(await db.query("select id from meta_outbox where lead_id='lead-meta-990033'")).rows[0]
  await db.query("update meta_outbox set state='retry',attempt=1,next_attempt_at=now()-interval '1 second',payload=jsonb_build_object('event_id',id::text) where id=$1",[row.id])
  await db.query('select meta_request_retry($1,$2)',[admin,row.id])
  const updated=(await db.query('select * from meta_outbox where id=$1',[row.id])).rows[0]
  assert.equal(updated.id,row.id);assert.equal(updated.payload.event_id,row.id);assert.equal(updated.attempt,1);assert.equal(updated.state,'pending')
})
await test('Elle retry de beş denemeyi aşamaz',async()=>{
  await assert.rejects(db.query('select meta_request_retry($1,$2)',[admin,eid]))
})
console.log(`SQL testleri: ${passed}/${passed}. Bu motor gerçek çok oturumlu PostgreSQL yarış testi değildir.`)
await db.close()

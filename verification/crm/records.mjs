import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('./package.json',import.meta.url))
const {PGlite}=require('@electric-sql/pglite')
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),db=new PGlite()
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`)
const schema=read('docs/supabase_schema.sql');await db.exec(schema.slice(0,schema.indexOf('-- 4. PROJELER')))
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
const ids={admin:'00000000-0000-0000-0000-000000000001',member:'00000000-0000-0000-0000-000000000002',other:'00000000-0000-0000-0000-000000000003',finance:'00000000-0000-0000-0000-000000000004'}
for(const [name,id] of Object.entries(ids)){
 await db.query('INSERT INTO auth.users VALUES($1)',[id])
 await db.query("INSERT INTO app_users(id,full_name,username,password,department,role,scope,company_name) VALUES($1,$1,$1,'isolated-only',$2,$3,'ASSIGNED_ONLY',$4)",[name,name==='finance'?'Muhasebe':'Pazarlama',name==='admin'?'ADMIN':'MEMBER',name==='other'?'Other Company':'Company'])
}
await db.exec(read('supabase/migrations/202611040001_crm_identity_foundation.sql'))
for(const [name,id] of Object.entries(ids))await db.query('INSERT INTO crm_identities(auth_user_id,app_user_id) VALUES($1,$2)',[id,name])
const before=(await db.query("SELECT count(*)::int AS n FROM meta_members")).rows[0].n
const migration=read('supabase/migrations/202611050001_crm_record_backend.sql')
await db.exec(migration)
let passed=0,request=1
async function test(name,fn){await fn();passed++;console.log('GEÇTİ: '+name)}
const requestId=()=>`10000000-0000-0000-0000-${String(request++).padStart(12,'0')}`
async function as(user,fn,role='authenticated'){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[user]||''])
 await db.exec('SET ROLE '+role);try{return await fn()}finally{await db.exec('RESET ROLE')}
}
const write=(module,id,revision,payload={id},req=requestId(),archive=false)=>db.query('SELECT crm_backend_write($1,$2,$3,$4,$5::jsonb,$6) AS result',[req,module,id,revision,JSON.stringify(payload),archive]).then(r=>r.rows[0].result)
const list=(module,after='',limit=50)=>db.query('SELECT crm_backend_list($1,$2,$3) AS result',[module,after,limit]).then(r=>r.rows[0].result)
await test('Eklemeli migration tekrar uygulanabilir; Meta üyeliği değişmez',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM meta_members')).rows[0].n,before)})
await test('Anonim ve eşlemesiz kullanıcı listeleri okuyamaz',async()=>{
 await as('',()=>assert.rejects(list('projects')),'anon');await as('',()=>assert.rejects(list('projects')))
})
await test('Yeni modüllerin yazımı sunucuda kapalı başlar',()=>as('admin',()=>assert.rejects(write('projects','p',0),/crm_module_not_activated/)))
await db.exec('UPDATE crm_backend.module_settings SET write_enabled=true')
await test('İstemci tabloya ve audit kayıtlarına doğrudan erişemez',()=>as('admin',async()=>{
 await assert.rejects(db.query('SELECT * FROM crm_backend.records'));await assert.rejects(db.query('DELETE FROM crm_backend.write_audit'))
}))
await test('Yönetici proje oluşturur; nested daire ve çizim bilgisi kaybolmaz',()=>as('admin',async()=>{
 const result=await write('projects','p',0,{id:'p',units:[{id:'unit',custom:{x:3}}],layout:{blocks:[1,2]}});assert.equal(result.revision,1)
 const row=(await list('projects')).records[0];assert.deepEqual(row.payload.units,[{id:'unit',custom:{x:3}}]);assert.equal(row.owner_id,'admin')
}))
await test('Personel projeleri okur ancak proje yazamaz',()=>as('member',async()=>{assert.equal((await list('projects')).records.length,1);await assert.rejects(write('projects','forged',0),/crm_forbidden/)}))
await test('Aynı işlem tekrarında revision ve audit çoğalmaz',()=>as('admin',async()=>{
 const req=requestId(),payload={id:'p',name:'updated'};const a=await write('projects','p',1,payload,req);const b=await write('projects','p',1,payload,req)
 assert.equal(a.revision,2);assert.equal(b.revision,2);assert.equal(b.replayed,true)
 await assert.rejects(write('projects','p',1,{id:'p',name:'different'},req),/crm_request_conflict/)
}))
await test('Eski revision başka istemcinin değişikliğini ezemez',()=>as('admin',async()=>{await assert.rejects(write('projects','p',1),/crm_revision_conflict/);assert.equal((await list('projects')).records[0].revision,2)}))
await test('Yeni kayıt aynı kimlikle revision sıfırdan tekrar yaratılamaz',()=>as('admin',()=>assert.rejects(write('projects','p',0),/crm_revision_conflict/)))
await test('Şirket sınırı yönetici dahil korunur',()=>as('other',async()=>{assert.equal((await list('projects')).records.length,0);await assert.rejects(write('projects','p',2),/crm_forbidden/)}))
await test('Randevu sahibi sunucu kimliğidir; başka kişi alanı yetki sağlamaz',()=>as('member',async()=>{
 await write('appointments','a',0,{id:'a',owner_id:'admin',createdByUserId:'admin'});const row=(await list('appointments')).records[0];assert.equal(row.owner_id,'member')
}))
await test('Başka personel randevu içeriğini okuyamaz veya değiştiremez',()=>as('finance',async()=>{assert.equal((await list('appointments')).records.length,0);await assert.rejects(write('appointments','a',1),/crm_forbidden/)}))
await test('Muhasebe kayıtları genel personele kapalıdır',async()=>{
 await as('finance',()=>write('payments','money',0,{id:'money',amount:100}));await as('member',async()=>{assert.equal((await list('payments')).records.length,0);await assert.rejects(write('payments','x',0),/crm_forbidden/)})
})
await test('Genel kayıt endpointi onay kararı veremez',()=>as('admin',()=>assert.rejects(write('approvals','approval',0,{id:'approval',status:'ONAYLANDI'}),/crm_approval_workflow_required/)))
await test('Bilinmeyen modül, null ve geçersiz kimlik reddedilir',()=>as('admin',async()=>{
 await assert.rejects(write('meta_outbox','x',0),/crm_invalid_input/);await assert.rejects(write('projects','x',0,{id:'other'}),/crm_invalid_input/)
 await assert.rejects(list('projects','',0),/crm_invalid_input/);await assert.rejects(list('projects','',101),/crm_invalid_input/)
}))
await test('Sayfalama kimlik sırasını korur ve sonraki kaydı belirtir',()=>as('admin',async()=>{
 await write('projects','p2',0);await write('projects','p3',0);const page=await list('projects','',1);assert.equal(page.records[0].id,'p');assert.equal(page.has_more,true)
 assert.equal((await list('projects','p',1)).records[0].id,'p2')
}))
await test('Arşivleme fiziksel silmez, eski istemci kaydı diriltemez',async()=>{
 await as('admin',()=>write('projects','p3',1,{},requestId(),true))
 const row=(await db.query("SELECT deleted,revision FROM crm_backend.records WHERE id='p3'")).rows[0];assert.equal(row.deleted,true);assert.equal(Number(row.revision),2)
 await as('admin',()=>assert.rejects(write('projects','p3',2),/crm_revision_conflict/))
})
await test('Audit yazımı başarısızsa kayıt değişikliği de geri alınır',async()=>{
 await db.exec("CREATE FUNCTION crm_backend.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'isolated audit failure';END$$;CREATE TRIGGER fail_audit BEFORE INSERT ON crm_backend.write_audit FOR EACH ROW EXECUTE FUNCTION crm_backend.fail_audit()")
 await as('admin',()=>assert.rejects(write('projects','p2',1,{id:'p2',changed:true}),/isolated audit failure/))
 assert.equal((await db.query("SELECT revision::int AS revision FROM crm_backend.records WHERE id='p2'")).rows[0].revision,1)
 await db.exec('DROP TRIGGER fail_audit ON crm_backend.write_audit')
})
await test('Devre dışı kimlik eski oturumla dahi okuyamaz',async()=>{
 await db.query('UPDATE crm_identities SET active=false WHERE app_user_id=$1',['member']);await as('member',()=>assert.rejects(list('projects'),/crm_identity_not_assigned/))
})
await test('Migration tekrarı yazım kilidini veya veriyi sıfırlamaz',async()=>{await db.exec(migration);assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_backend.records')).rows[0].n,5);assert.equal((await db.query("SELECT write_enabled FROM crm_backend.module_settings WHERE module='projects'")).rows[0].write_enabled,true)})
await db.exec(read('supabase/migrations/202611060001_crm_appointment_validation.sql'))
await test('Randevu tarihi ve saati sunucuda doğrulanır, kayıt sahibi değiştirilemez',async()=>{
 const payload={id:'central-appointment',customerName:'İzole',date:'2026-11-06',time:'14:00',type:'OFFICE',status:'SCHEDULED',createdByUserId:'admin'}
 await as('finance',async()=>{
  await assert.rejects(write('appointments',payload.id,0,{...payload,date:'2026-02-30'}),/crm_invalid_input/)
  await assert.rejects(write('appointments',payload.id,0,{...payload,time:'24:00'}),/crm_invalid_input/)
  await write('appointments',payload.id,0,payload)
 })
 await as('admin',async()=>{
  await write('appointments',payload.id,1,{...payload,status:'COMPLETED'})
  const row=(await list('appointments')).records.find(row=>row.id===payload.id)
  assert.equal(row.payload.createdByUserId,'finance')
  assert.equal(row.payload.createdByDepartment,'Muhasebe')
  assert.equal(row.payload.status,'COMPLETED')
 })
})
await db.exec(read('supabase/migrations/202611080001_crm_requests_finance.sql'))
await test('Talep alanları sunucuda doğrulanır',()=>as('admin',async()=>{
 await assert.rejects(write('requests','request-invalid',0,{id:'request-invalid'}),/crm_invalid_input/)
 await write('requests','request-valid',0,{id:'request-valid',customerName:'İzole',subject:'Test',priority:'Orta',status:'Açık',category:'Genel Talep'})
 assert.equal((await list('requests')).records.length,1)
}))
await test('Negatif veya sahte tutar reddedilir; kesinleşmiş ödeme geri açılamaz',()=>as('finance',async()=>{
 const payment={id:'payment-valid',title:'İzole',payee:'İzole',category:'OFFICE',amount:125.5,dueDate:'2026-11-08',status:'PENDING'}
 await assert.rejects(write('payments',payment.id,0,{...payment,amount:-1}),/crm_invalid_input/)
 await write('payments',payment.id,0,payment)
 await write('payments',payment.id,1,{...payment,status:'PAID'})
 await assert.rejects(write('payments',payment.id,2,payment),/crm_financial_record_locked/)
 await assert.rejects(write('payments',payment.id,2,{},requestId(),true),/crm_financial_record_locked/)
}))
await test('Tahsil edilmemiş kapora iade edilemez; iade eden sunucudan belirlenir',()=>as('finance',async()=>{
 const collection={id:'deposit-valid',customerName:'İzole',type:'DEPOSIT',amount:500,dueDate:'2026-11-08',status:'PENDING'}
 await write('collections',collection.id,0,collection)
 await assert.rejects(write('collections',collection.id,1,{...collection,status:'REFUNDED',refundReason:'Test'}),/crm_invalid_refund/)
 await write('collections',collection.id,1,{...collection,status:'COLLECTED'})
 await write('collections',collection.id,2,{...collection,status:'REFUNDED',refundReason:'İzole iade',refundedByUserName:'forged'})
 const row=(await list('collections')).records.find(row=>row.id===collection.id)
 assert.equal(row.payload.refundedByUserName,'finance')
}))
await db.exec(read('supabase/migrations/202611080002_crm_approval_decisions.sql'))
await test('Onay kararı sunucu yetkisi ve tek işlem kimliği gerektirir',async()=>{
 await db.exec("UPDATE crm_identities SET active=true WHERE app_user_id='member'")
 const body={id:'approval-valid',type:'İskonto / İndirim',title:'İzole',reason:'İzole gerekçe',status:'BEKLEMEDE'}
 await as('member',()=>write('approvals',body.id,0,body))
 const req=requestId()
 const decide=()=>db.query("SELECT crm_decide_approval($1,$2,1,'ONAYLANDI','İzole') AS result",[req,body.id]).then(r=>r.rows[0].result)
 await as('member',()=>assert.rejects(decide(),/crm_forbidden/))
 await as('admin',async()=>{
  const first=await decide(),second=await decide()
  assert.equal(first.revision,2);assert.equal(second.replayed,true)
  const row=(await list('approvals')).records.find(row=>row.id===body.id)
  assert.equal(row.payload.reviewedByUserId,'admin')
  assert.equal(row.payload.requestedByUserId,'member')
  await assert.rejects(write('approvals',body.id,2,body),/crm_approval_workflow_required/)
 })
})
await db.exec(`CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT ON storage.objects TO authenticated;`)
await db.exec(read('supabase/migrations/202611080005_crm_private_files.sql'))
await test('Özel dosyanın hem listesi hem nesnesi yalnızca izin verilen kişiye açılır',async()=>{
 const path=ids.finance+'/isolated-file'
 const file={id:'isolated-file',name:'isolated.txt',storagePath:path,shareTarget:'MEMBERS',targetMemberIds:['member'],permissions:{canView:true,canEdit:false,canReshare:false}}
 await as('finance',async()=>{
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('crm-private',$1)",[path])
  await write('files',file.id,0,file)
 })
 await as('member',async()=>{
  assert.equal((await db.query('SELECT crm_file_list() AS r')).rows[0].r.records.length,1)
  assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE name=$1",[path])).rows[0].n,1)
  const req=requestId()
  await db.query('SELECT crm_log_file_download($1,$2)',[file.id,req])
  await db.query('SELECT crm_log_file_download($1,$2)',[file.id,req])
 })
 await as('admin',async()=>{
  assert.equal((await list('files')).records.length,0)
  assert.equal((await db.query('SELECT crm_file_list() AS r')).rows[0].r.records.length,0)
  assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE name=$1",[path])).rows[0].n,0)
  await assert.rejects(write('files',file.id,1,{...file,shareTarget:'ALL_TEAM'}),/crm_forbidden/)
 })
 assert.equal((await db.query('SELECT count(*)::int n FROM crm_backend.file_downloads')).rows[0].n,1)
})

await db.exec(read('supabase/migrations/202611080006_crm_projects.sql'))
await db.exec(read('supabase/migrations/202611080007_crm_file_notes.sql'))
await test('Proje geçersiz fiyatı, tekrarlı daire kimliğini ve personelin yetkisiz yazımını reddeder',async()=>{
 await as('member',()=>assert.rejects(write('projects','forged2',0,{id:'forged2',name:'Test',units:[]}),/crm_forbidden/))
 await as('admin',async()=>{
  await assert.rejects(write('projects','bad-price',0,{id:'bad-price',name:'Test',units:[{id:'u',status:'SATISTA',price:-1}]}),/crm_invalid_input/)
  await assert.rejects(write('projects','duplicate-units',0,{id:'duplicate-units',name:'Test',units:[{id:'u',status:'SATISTA',price:1},{id:'u',status:'SATISTA',price:1}]}),/crm_invalid_input/)
 })
})
await test('Satış sunucu aktörü ve zamanıyla kaydedilir; tekrar aynı canonical sonucu verir',()=>as('admin',async()=>{
 const project={id:'validated-project',name:'Test',units:[{id:'u',status:'SATISTA',price:100,history:[]}]}
 await write('projects',project.id,0,project)
 const sold={...project,units:[{...project.units[0],status:'SATILDI',sale:{customerName:'Isolated',salePrice:90,soldByUserId:'forged',soldAt:'2000-01-01'}}]}
 const req=requestId(),a=await write('projects',project.id,1,sold,req),b=await write('projects',project.id,1,sold,req)
 assert.equal(a.payload.units[0].sale.soldByUserId,'admin');assert.equal(a.payload.units[0].history.length,1)
 assert.deepEqual(a.payload,b.payload);assert.equal(b.replayed,true)
 await assert.rejects(write('projects',project.id,2,{...a.payload,units:[{...a.payload.units[0],sale:{...a.payload.units[0].sale,salePrice:1}}]}),/crm_forbidden/)
}))
await test('Dosya not izni paylaşım yetkisi vermez ve retry kayıt çoğaltmaz',async()=>{
 const path=ids.finance+'/editable-file',file={id:'editable-file',name:'isolated.txt',storagePath:path,shareTarget:'MEMBERS',targetMemberIds:['member'],permissions:{canView:true,canEdit:true,canReshare:false}}
 await as('finance',async()=>{await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('crm-private',$1)",[path]);await write('files',file.id,0,file)})
 await as('member',async()=>{
  const req=requestId(),payload={...file,notes:'Updated note',shareTarget:'ALL_TEAM'}
  const args=[req,'files',file.id,1,JSON.stringify(payload),false]
  const result=(await db.query('SELECT crm_file_notes_write($1,$2,$3,$4,$5::jsonb,$6) r',args)).rows[0].r
  assert.equal(result.payload.shareTarget,'MEMBERS');assert.equal(result.payload.notes,'Updated note')
  assert.equal((await db.query('SELECT crm_file_notes_write($1,$2,$3,$4,$5::jsonb,$6) r',args)).rows[0].r.replayed,true)
 })
})


await db.exec(read('supabase/migrations/202611080009_crm_extra_modules.sql'))
await db.exec('UPDATE crm_backend.module_settings SET write_enabled=true')
await test('Rehber şirket/personel sınırını korur; yaratıcı akış atomik ve yetkilidir',async()=>{
 await as('member',()=>write('contacts','private-contact',0,{id:'private-contact',fullName:'Isolated',phone:'1234567890',category:'DIGER'}))
 await as('finance',async()=>{assert.equal((await list('contacts')).records.length,0);await assert.rejects(write('creative_assets','forged-asset',0,{id:'forged-asset',title:'Test',status:'TASLAK'}),/crm_forbidden/)})
 await as('admin',async()=>{
  await write('creative_assets','isolated-asset',0,{id:'isolated-asset',title:'Test',status:'INCELEMEDE'})
  const comment={id:'isolated-comment',creativeId:'isolated-asset',content:'Review',type:'ONAY',authorName:'forged'}
  const saved=await write('creative_comments',comment.id,0,comment)
  assert.equal(saved.payload.authorName,'admin')
  const asset=(await list('creative_assets')).records.find(r=>r.id==='isolated-asset')
  assert.equal(asset.payload.status,'ONAYLANDI');assert.equal(asset.revision,2)
 })
})

await db.exec(read('supabase/migrations/202611080010_crm_calendar_messages.sql'))
await db.exec('UPDATE crm_backend.module_settings SET write_enabled=true')
await test('Mesajları yalnızca gönderen/alıcı görür; üçüncü kişi ve yönetici konuşmayı okuyamaz',async()=>{
 const message={id:'isolated-message',recipientId:'finance',conversationId:'forged',senderId:'admin',text:'Isolated message',isRead:true}
 await as('member',async()=>{
  const saved=await write('messages',message.id,0,message)
  assert.equal(saved.payload.senderId,'member');assert.equal(saved.payload.isRead,false);assert.equal(saved.payload.conversationId,'finance::member')
 })
 await as('admin',async()=>{assert.equal((await list('messages')).records.length,0);await db.query("SELECT crm_mark_messages_read('member')")})
 await as('other',()=>assert.rejects(write('messages','cross-company',0,{...message,id:'cross-company'}),/crm_invalid_input/))
 await as('finance',async()=>{
  assert.equal((await list('messages')).records.length,1)
  await db.query("SELECT crm_mark_messages_read('member')")
  assert.equal((await list('messages')).records[0].payload.isRead,true)
  await assert.rejects(write('messages',message.id,2,{...message,text:'edited'}),/crm_forbidden/)
 })
})
await test('Kişisel takvim sunucuda gizlidir; paylaşım ve tarih doğrulanır',async()=>{
 const event={id:'private-calendar',title:'Isolated',date:'2026-11-08',time:'12:00',visibilityScope:'PERSONAL',sharedDepartments:[],sharedUserIds:[],createdByUserId:'admin'}
 await as('member',async()=>{const saved=await write('calendar',event.id,0,event);assert.equal(saved.payload.createdByUserId,'member')})
 await as('admin',async()=>assert.equal((await list('calendar')).records.length,0))
 await as('finance',async()=>{assert.equal((await list('calendar')).records.length,0);await assert.rejects(write('calendar','invalid-date',0,{...event,id:'invalid-date',date:'2026-02-30'}))})
 await as('member',()=>write('calendar',event.id,1,{...event,visibilityScope:'USERS',sharedUserIds:['finance']}))
 await as('finance',()=>list('calendar').then(r=>assert.equal(r.records.length,1)))
})

await db.exec(read('supabase/migrations/202611080011_crm_team_operations.sql'))
await db.exec('UPDATE crm_backend.module_settings SET write_enabled=true')
await test('Zimmet devri tek sahibini korur ve gerçek sunucu aktörünü kaydeder',async()=>{
 const asset={id:'isolated-asset-key',name:'Isolated key',codeOrPlate:'Test',category:'EKIPMAN',holderUserId:null,holderUserName:null,takenAt:null,destinationNote:null,expectedReturnTime:null}
 await as('member',()=>assert.rejects(write('team_assets',asset.id,0,asset),/crm_forbidden/))
 await as('admin',()=>write('team_assets',asset.id,0,asset))
 await as('member',async()=>{
  const current=(await list('team_assets')).records.find(r=>r.id===asset.id).payload;const saved=await write('team_assets',asset.id,1,{...current,holderUserId:'member',holderUserName:'forged',autoPresenceStatus:'GOSTERIMDE'})
  assert.equal(saved.payload.holderUserName,'member');assert.equal(saved.payload.history.length,1)
  assert.equal((await list('team_presence')).records.find(r=>r.id==='member').payload.status,'GOSTERIMDE')
 })
 await as('finance',()=>assert.rejects(write('team_assets',asset.id,2,{...asset,holderUserId:'finance'}),/crm_forbidden/))
 await as('member',async()=>{const current=(await list('team_assets')).records.find(r=>r.id===asset.id);const saved=await write('team_assets',asset.id,2,{...current.payload,holderUserId:null});assert.equal(saved.payload.history.length,2)})
})
await test('Personel kendi iznini onaylayamaz ve başka personelin durumunu değiştiremez',async()=>{
 const leave={id:'isolated-leave',userId:'forged',leaveType:'YILLIK_IZIN',startDate:'2026-12-01',endDate:'2026-12-02',reason:'Isolated',status:'BEKLEMEDE'}
 let saved
 await as('member',async()=>{
  saved=(await write('team_leaves',leave.id,0,leave)).payload;assert.equal(saved.userId,'member')
  await assert.rejects(write('team_leaves',leave.id,1,{...saved,status:'ONAYLANDI'}),/crm_forbidden/)
  await assert.rejects(write('team_presence','finance',0,{id:'finance',status:'MESAI_DISI'}),/crm_forbidden/)
 })
 await as('admin',async()=>{const decision=await write('team_leaves',leave.id,1,{...saved,status:'ONAYLANDI',reviewedBy:'forged'});assert.equal(decision.payload.reviewedBy,'admin')})
})
await db.close();console.log(`CRM backend SQL: ${passed}/${passed}; izole motor, gerçek çok oturumlu yarış testi değildir.`)

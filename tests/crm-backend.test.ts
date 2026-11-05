import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCrmBackendRepository} from '../src/services/crmBackendRepository.ts'
import {previewCrmMigration} from '../src/services/crmMigrationPreview.ts'
import {readExistingCrmAccessToken,createExistingSessionCrmClient} from '../src/services/crmExistingSession.ts'
import {createCrmAuthService} from '../src/services/crmAuthService.ts'
function setup(response:any){const calls:any[]=[];const client:any={rpc:(name:string,args:any)=>{calls.push({name,args});return {abortSignal:async()=>response}}};return {repo:createCrmBackendRepository(client),calls}}
test('Mevcut oturum yalnızca aynı proje anahtarından okunur; refresh tokenı döndürülmez',()=>{
 const reads:string[]=[]
 const token=readExistingCrmAccessToken({getItem:key=>{reads.push(key);return JSON.stringify({access_token:'access-only',refresh_token:'must-not-copy',user:{role:'ADMIN'}})}},'https://isolated.supabase.co')
 assert.equal(token,'access-only');assert.deepEqual(reads,['sb-isolated-auth-token'])
})
test('Yerel CRM rolü veya bozuk storage sunucu erişimi sağlamaz',()=>{
 for(const value of ['broken','null','{"role":"ADMIN"}','{"access_token":123}'])assert.throws(()=>readExistingCrmAccessToken({getItem:()=>value},'https://isolated.supabase.co'))
})
test('Gerçek SDK mevcut JWT ile Auth ve profil doğrular; refresh/revoke veya eski storage yazımı yoktur',async()=>{
 const urls:string[]=[]
 const client=createExistingSessionCrmClient({url:'https://isolated.supabase.co',publicKey:'isolated-public-key',storage:{getItem:()=>JSON.stringify({access_token:'access-only',refresh_token:'must-not-use'})},fetcher:async(url,init)=>{
  urls.push(String(url));assert.equal(new Headers(init?.headers).get('authorization'),'Bearer access-only')
  if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'auth-id',aud:'authenticated'})
  if(String(url).endsWith('/rest/v1/rpc/crm_get_my_profile'))return Response.json({auth_user_id:'auth-id',id:'employee',full_name:'İzole',username:'isolated',department:'Pazarlama',role:'MEMBER',scope:'ASSIGNED_ONLY'})
  throw Error('Unexpected endpoint')
 }})
 const profile=await createCrmAuthService(client).getProfile();assert.equal(profile.role,'MEMBER');assert.equal(urls.length,2)
 assert.equal(urls.some(u=>u.includes('/token')||u.includes('/logout')),false)
})
test('Backend sayfalaması fazladan kontrol kaydını göstermeden imleç döndürür',async()=>{
 const s=setup({data:{records:[{id:'a',revision:1,payload:{}},{id:'b',revision:1,payload:{}}],has_more:true}})
 const result=await s.repo.list('projects','',1);assert.equal(result.records.length,1);assert.equal(result.next,'a')
})
test('Backend hata yanıtı kullanıcıya başarı diye sunulmaz',async()=>{
 const s=setup({error:{message:'crm_revision_conflict'}})
 await assert.rejects(s.repo.write({requestId:'same',module:'projects',id:'a',revision:2,payload:{id:'a'}}),/başka bir oturumda/)
 assert.equal(s.calls.length,1)
})
test('Yazım tekrarı request kimliğini korur; otomatik ağ tekrarı yapmaz',async()=>{
 const s=setup({data:{id:'a',revision:3,updated_at:'2026-11-05T00:00:00Z',replayed:true}})
 const command={requestId:'stable',module:'projects' as const,id:'a',revision:2,payload:{id:'a'}}
 assert.equal((await s.repo.write(command)).replayed,true);assert.equal(s.calls[0].args.p_request,'stable');assert.equal(s.calls.length,1)
})
test('Eksik veya yanlış yazım cevabı kabul edilmez',async()=>{
 const s=setup({data:{id:'other',revision:2}})
 await assert.rejects(s.repo.write({requestId:'stable',module:'projects',id:'a',revision:1,payload:{id:'a'}}),/doğrulanamadı/)
})
test('Yerel aktarım önizlemesi salt okunur; sır ve Meta anahtarlarını istemez',async()=>{
 const keys:string[]=[]
 const preview=await previewCrmMigration({getItem:key=>{keys.push(key);return key==='demirturk_projects_v2'?'[{"id":"a"},{"id":"a"},{}]':'[]'}})
 const row=preview.find(r=>r.module==='projects')!;assert.equal(row.duplicateIds,1);assert.equal(row.missingIds,1);assert.equal(row.valid,false)
 assert.equal(keys.some(key=>/user|auth|meta|lead/i.test(key)),false);assert.match(row.fingerprint,/^[a-f0-9]{64}$/)
})
test('Bozuk yerel JSON önizlemeyi durdurmaz ve veri üretmez',async()=>{
 const rows=await previewCrmMigration({getItem:()=>'{broken'});assert.equal(rows.length,7);assert.ok(rows.every(r=>!r.valid&&r.count===0))
})

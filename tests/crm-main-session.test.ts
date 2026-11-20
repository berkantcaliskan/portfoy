import {test} from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import ts from 'typescript'
import {createCrmMainSession} from '../src/services/crmMainSession.ts'
import * as department from '../src/types/department.ts'

const profile={authUserId:'isolated-auth',id:'isolated-staff',fullName:'İzole Kullanıcı',username:'isolated',email:'isolated@example.invalid',department:'Satış',departments:['Satış'],role:'MEMBER',scope:'ASSIGNED_ONLY',companyName:'İzole',isManager:false,permissions:{},createdAt:'2026-11-05'} as any
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve}}

test('Çıkıştan önce başlayan profil cevabı oturumu yeniden açamaz',async()=>{
 const pending=deferred(),published:any[]=[]
 const session=createCrmMainSession({getProfile:()=>pending.promise,signInWithPassword:async()=>profile,signOut:async()=>{}},p=>published.push(p))
 const restore=session.restore();await session.logout();pending.resolve(profile);await restore
 assert.deepEqual(published,[null])
})
test('Eski profil cevabı daha yeni girişin kimliğini ezemez',async()=>{
 const pending=deferred(),published:any[]=[]
 const session=createCrmMainSession({getProfile:()=>pending.promise,signInWithPassword:async()=>profile,signOut:async()=>{}},p=>published.push(p))
 const restore=session.restore();await session.login('isolated@example.invalid',' IsolatedPassword123 ');pending.resolve({...profile,role:'ADMIN'});await restore
 assert.equal(published.at(-1).role,'MEMBER')
})
test('Başarısız sunucu kontrolü veya giriş yerel profile düşmez',async()=>{
 const published:any[]=[]
 const session=createCrmMainSession({getProfile:async()=>{throw Error('denied')},signInWithPassword:async()=>{throw Error('denied')},signOut:async()=>{}},p=>published.push(p))
 await session.restore();await assert.rejects(session.login('isolated@example.invalid','wrong'));assert.equal(published.every(p=>p===null),true)
})

function storeHarness(authenticatedProfile=profile){
 let reads=0,writes=0,saves=0,authCalls=0
 let authListener:(event:string,session:any)=>void=()=>{}
 const mod={exports:{} as any}
 const fakeAuth={getProfile:async()=>{authCalls++;return authenticatedProfile},signInWithPassword:async(email:string,password:string)=>{authCalls++;assert.equal(email,'isolated@example.invalid');assert.equal(password,' IsolatedPassword123 ');return authenticatedProfile},signOut:async()=>{}}
 const storage={getItem:()=>{reads++;return JSON.stringify([{...profile,role:'ADMIN',password:'wrong'}])},setItem:()=>{writes++},removeItem:()=>{writes++}}
 const mocks:any={
  '@/types/department':department,
  './supabaseClient':{supabase:{auth:{signOut:async()=>({error:null})}},isSupabaseConfigured:()=>true},
  './syncService':{syncService:{saveUser:()=>{saves++},deleteUser:()=>{saves++}}},
  './dbMapper':{rowToUser:(v:any)=>v},'./crmRuntime':{isCentralCrm:()=>true},
  './crmBackendClient':{createBackendPreviewClient:()=>({rpc:()=>({then:(resolve:any)=>Promise.resolve({data:null,error:{message:'denied'}}).then(resolve),abortSignal:async()=>({data:null,error:{message:'denied'}})}),auth:{onAuthStateChange:(listener:any)=>{authListener=listener;return {data:{subscription:{unsubscribe(){}}}}}}})},
  './crmAuthService':{createCrmAuthService:()=>fakeAuth},'./crmMainSession':{createCrmMainSession},
  './crmAccountService':{createCrmAccountService:()=>({changePassword:async()=>{throw Error('Unexpected password change')}})},
 }
 const source=fs.readFileSync(new URL('../src/services/userStore.ts',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const windowListeners = new Map<string, () => void>()
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require:(name:string)=>{if(!(name in mocks))throw Error('Unmocked dependency');return mocks[name]},localStorage:storage,window:{addEventListener(name:string,listener:()=>void){windowListeners.set(name,listener)}},console,setTimeout,Set,Map,crypto})
 return {
   store:mod.exports.userStore,stats:()=>({reads,writes,saves,authCalls}),
   authEvent:(event:string,authUserId:string)=>authListener(event,{user:{id:authUserId}}),
   refreshProfile: async (nextProfile: typeof profile) => {
     authenticatedProfile = nextProfile
     windowListeners.get('focus')?.()
     await new Promise(resolve => setImmediate(resolve))
   },
 }
}

test('Yalnız ADMIN tüm departmanlara geçer ve sunucu yetkisi kaldırılınca geçiş daralır', async () => {
 const manager = {...profile, department:'Yönetim', departments:[], role:'ADMIN', isManager:true}
 const {store, refreshProfile} = storeHarness(manager)
 await store.loginWithServer('isolated@example.invalid',' IsolatedPassword123 ')
 for (const target of department.CANONICAL_DEPARTMENTS) {
   assert.equal(store.switchDepartment(target).success, true)
   assert.equal(store.getCurrentUser().department, target)
 }
 store.switchDepartment('Muhasebe')
 await refreshProfile(manager)
 assert.equal(store.getCurrentUser().department, 'Muhasebe')
 await refreshProfile({...profile, role:'MANAGER', isManager:true, departments:['Satış','Kreatif']})
 assert.equal(store.getCurrentUser().department, 'Satış')
 assert.equal(store.switchDepartment('Kreatif').success, true)
 assert.equal(store.switchDepartment('Muhasebe').success, false)
 assert.equal(store.switchDepartment('Yönetim').success, false)
})
test('Ana store sahte yerel yönetici hesabını yüklemez ve yerel parolayı kabul etmez',()=>{
 const s=storeHarness();assert.equal(s.store.getCurrentUser(),null);assert.equal(s.stats().reads,0)
 assert.equal(s.store.login('isolated','wrong').success,false);assert.equal(s.stats().authCalls,0)
 assert.throws(()=>s.store.registerAdmin({}),/sunucu/)
})
test('Doğrulanan profil yerel senkronizasyonla ezilemez; parola diske veya eski sync servisine yazılmaz',async()=>{
 const s=storeHarness();await s.store.loginWithServer('isolated@example.invalid',' IsolatedPassword123 ')
 s.store.setLoadedUsers([{...profile,role:'ADMIN'}]);s.store.reloadUsersFromStorage()
 assert.equal(s.store.getCurrentUser().role,'MEMBER');assert.equal(s.store.getCurrentUser().password,'')
 assert.equal(s.store.switchDepartment('Yönetim').success,false)
 assert.equal((await s.store.updateUser(profile.id,{role:'ADMIN'})).success,false)
 assert.equal(s.store.changePassword(profile.id,'fake').success,false)
 await assert.rejects(s.store.addMember({}),/yönetici/)
 assert.equal(s.stats().reads,0);assert.equal(s.stats().writes,0);assert.equal(s.stats().saves,0)
 s.store.logout();assert.equal(s.store.getCurrentUser(),null)
})

test('Çıkıştan sonra gelen personel parolası başka oturuma gösterilemez', async () => {
 for (const action of ['create', 'reset']) {
  const { store } = storeHarness(), pending = deferred()
  store.currentUser = { ...profile, id: 'admin-a', role: 'ADMIN' }
  store.serverClient = { functions: { invoke: () => pending.promise } }
  const operation = action === 'create'
   ? store.addMember({ fullName: 'Isolated staff', department: 'Satış', role: 'MEMBER', scope: 'ASSIGNED_ONLY' })
   : store.resetStaffPassword('staff-b')
  store.currentUser = { ...profile, id: 'other-account' }
  pending.resolve({ data: { user: { id: 'staff-b', username: 'isolated' }, generatedPassword: 'isolated-test-only' }, error: null })
  await assert.rejects(operation, /oturum değişti/)
 }
})

test('Çift personel tıklaması tek istek yapar; liste yavaşken parola sonucu bekletilmez', async () => {
 const { store } = storeHarness(), pending = deferred()
 let calls = 0
 store.currentUser = { ...profile, id: 'admin-a', role: 'ADMIN' }
 store.serverClient = { functions: { invoke: () => { calls++; return pending.promise } }, rpc: () => ({ abortSignal: () => new Promise(() => {}) }) }
 const input = { fullName: 'Isolated staff', department: 'Satış', role: 'MEMBER', scope: 'ASSIGNED_ONLY' }
 const first = store.addMember(input)
 await assert.rejects(store.addMember(input), /oluşturuluyor/)
 pending.resolve({ data: { user: { id: 'staff-b', username: 'isolated' }, generatedPassword: 'isolated-test-only' }, error: null })
 const result = await first
 assert.equal(result.generatedPassword, 'isolated-test-only')
 assert.equal(calls, 1)
})

test('Yetki kaydı düzenleme açılırken alınan sürümü gönderir ve reddi yerel başarıya çevirmez',async()=>{
 const {store}=storeHarness()
 store.currentUser={...profile,id:'actor-admin',role:'ADMIN'}
 const target={...profile,id:'target-staff',serverRevision:12}
 store.users=[target]
 let sent:any
 store.serverClient={rpc:async(name:string,args:any)=>{
  sent={name,args}
  return {error:{message:'crm_invalid_input'}}
 }}
 const result=await store.updateUser(target.id,{role:'ADMIN'},10)
 assert.equal(sent.name,'crm_manage_staff')
 assert.equal(sent.args.p_updates._revision,10)
 assert.equal(sent.args.p_updates.role,'ADMIN')
 assert.equal(result.success,false)
 assert.match(result.error,/ADMIN yükseltme güncellemesi/)
 assert.equal(store.users[0].role,'MEMBER')
})

test('Pencereye dönünce gelen aynı kullanıcı SIGNED_IN olayı ekranı girişe düşürmez',async()=>{
 const {store,authEvent}=storeHarness()
 await store.loginWithServer('isolated@example.invalid',' IsolatedPassword123 ')
 const published:any[]=[];store.subscribe(()=>published.push(store.getCurrentUser()))
 authEvent('SIGNED_IN',profile.authUserId)
 assert.equal(store.getCurrentUser().id,profile.id)
 await new Promise(resolve=>setTimeout(resolve,10))
 assert.ok(published.every(p=>p!==null))
 authEvent('SIGNED_IN','another-auth')
 assert.equal(store.getCurrentUser(),null)
})

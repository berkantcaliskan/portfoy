import {test} from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import ts from 'typescript'
import {createCrmMainSession} from '../src/services/crmMainSession.ts'

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

function storeHarness(){
 let reads=0,writes=0,saves=0,authCalls=0
 const mod={exports:{} as any}
 const fakeAuth={getProfile:async()=>{authCalls++;return profile},signInWithPassword:async(email:string,password:string)=>{authCalls++;assert.equal(email,'isolated@example.invalid');assert.equal(password,' IsolatedPassword123 ');return profile},signOut:async()=>{}}
 const storage={getItem:()=>{reads++;return JSON.stringify([{...profile,role:'ADMIN',password:'wrong'}])},setItem:()=>{writes++},removeItem:()=>{writes++}}
 const mocks:any={
  '@/types/department':{CANONICAL_DEPARTMENTS:['Satış','Yönetim'],normalizeDepartmentName:(v:string)=>v},
  './supabaseClient':{supabase:{auth:{signOut:async()=>({error:null})}},isSupabaseConfigured:()=>true},
  './syncService':{syncService:{saveUser:()=>{saves++},deleteUser:()=>{saves++}}},
  './dbMapper':{rowToUser:(v:any)=>v},'./crmRuntime':{isCentralCrm:()=>true},
  './crmBackendClient':{createBackendPreviewClient:()=>({rpc:()=>({then:(resolve:any)=>Promise.resolve({data:null,error:{message:'denied'}}).then(resolve),abortSignal:async()=>({data:null,error:{message:'denied'}})}),auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})},
  './crmAuthService':{createCrmAuthService:()=>fakeAuth},'./crmMainSession':{createCrmMainSession},
 }
 const source=fs.readFileSync(new URL('../src/services/userStore.ts',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require:(name:string)=>{if(!(name in mocks))throw Error('Unmocked dependency');return mocks[name]},localStorage:storage,window:{addEventListener(){}},console,setTimeout,Set,Map})
 return {store:mod.exports.userStore,stats:()=>({reads,writes,saves,authCalls})}
}
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

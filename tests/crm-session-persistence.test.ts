import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCrmSessionStorage,CRM_AUTH_STORAGE_KEY as key} from '../src/services/crmSessionStorage.ts'
import {createCrmMainSession} from '../src/services/crmMainSession.ts'
import {getAccessibleDepartments,normalizeDepartmentName} from '../src/types/department.ts'
import {parseCrmProfile} from '../src/services/crmAuthService.ts'
const store=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}}}
test('Remembered CRM survives new windows; unchecked session stays temporary; logout clears both without touching Meta',()=>{
 const persistent=store(),firstWindow=store(),metaKey='sb-project-auth-token'
 persistent.setItem(metaKey,'isolated-meta-session')
 const first=createCrmSessionStorage(persistent,firstWindow)
 first.setItem(key,'isolated-crm-session')
 assert.equal(createCrmSessionStorage(persistent,store()).getItem(key),null)
 first.setRemembered(true)
 assert.equal(firstWindow.getItem(key),null)
 const reopened=createCrmSessionStorage(persistent,store())
 assert.equal(reopened.getItem(key),'isolated-crm-session')
 reopened.removeItem(key)
 assert.equal(first.getItem(key),null)
 assert.equal(persistent.getItem(metaKey),'isolated-meta-session')
})
test('Unchecking remember moves the current token out of persistent storage',()=>{
 const persistent=store(),temporary=store(),session=createCrmSessionStorage(persistent,temporary)
 session.setRemembered(true);session.setItem(key,'isolated');session.setRemembered(false)
 assert.equal(persistent.getItem(key),null);assert.equal(temporary.getItem(key),'isolated')
})
test('Background refresh retains validated profile during a network failure but revocation clears it',async()=>{
 const published:any[]=[];let fail=''
 const profile:any={id:'isolated'}
 const session=createCrmMainSession({getProfile:async()=>{if(fail)throw Object.assign(Error('isolated'),{code:fail});return profile},signInWithPassword:async()=>profile,signOut:async()=>{}},p=>published.push(p))
 await session.restore();fail='profile_unavailable';await session.restore();assert.deepEqual(published,[profile])
 fail='authentication_required';await session.restore();assert.equal(published.at(-1),null)
})
test('Front Office profile cannot switch to another department',()=>{
 const p:any={auth_user_id:'isolated',id:'staff',full_name:'Isolated',username:'isolated',department:'Ön Ofis',departments:['Ön Ofis'],role:'REPRESENTATIVE',scope:'DEPARTMENT'}
 const parsed=parseCrmProfile(p,'isolated')
 assert.deepEqual(getAccessibleDepartments(parsed),['Ön Ofis']);assert.equal(normalizeDepartmentName('Ön Ofis'),'Ön Ofis')
})

test('İkinci departman açık atamadır; yalnız ADMIN tüm alanları görür',()=>{
 assert.deepEqual(getAccessibleDepartments({role:'REPRESENTATIVE',department:'Satış',departments:['Satış','Kreatif']}),['Satış','Kreatif'])
 assert.deepEqual(getAccessibleDepartments({role:'REPRESENTATIVE',department:'Muhasebe',departments:['Muhasebe','Satış']}),['Satış','Muhasebe'])
 assert.deepEqual(getAccessibleDepartments({role:'REPRESENTATIVE',department:'Kreatif',departments:['Kreatif']}),['Kreatif'])
 assert.deepEqual(getAccessibleDepartments({role:'MANAGER',department:'Yönetim',departments:[]}),['Yönetim'])
 assert.equal(getAccessibleDepartments({role:'ADMIN',department:'Yönetim',departments:[]}).length,7)
})

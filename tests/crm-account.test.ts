import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCrmAccountService,validateNewCrmPassword} from '../src/services/crmAccountService.ts'
const profile={auth_user_id:'auth-id',id:'employee',full_name:'İzole',username:'isolated',department:'Pazarlama',role:'MEMBER',scope:'ASSIGNED_ONLY'}
function setup(options:any={}){
 const calls:any[]=[]
 const client:any={auth:{
  getUser:async()=>({data:{user:options.noUser?null:{id:'auth-id',email:'auth@example.invalid',...options.userFields}},error:null}),
  signUp:async(input:any)=>{calls.push({signup:input});return {data:{session:options.session?{}:null},error:options.signupError||null}},
  signInWithPassword:async(input:any)=>{calls.push({reauth:input});return {data:{user:{id:options.differentUser?'other':'auth-id'}},error:options.wrongPassword?{}:null}},
  updateUser:async(input:any)=>{calls.push({update:input});return {error:options.updateError?{}:null}},
  resetPasswordForEmail:async(...args:any[])=>{calls.push({reset:args});return {error:options.resetError||null}},
 },rpc:(name:string,args:any)=>{const run=async()=>{
  calls.push({rpc:name,args})
  if(name==='crm_get_my_profile')return {data:profile,error:options.noProfile?{message:'disabled'}:null}
  return options.rpc?options.rpc(name,args):{data:{valid:true},error:null}
 };return {abortSignal:run,then:(resolve:any,reject:any)=>run().then(resolve,reject)}}}
 return {service:createCrmAccountService(client),calls}
}
test('Yeni parola kuralı uygulanır; parola kırpılmaz',()=>{
 for(const p of ['short1','abcdefghijkl','123456789012','a1'.repeat(65)])assert.throws(()=>validateNewCrmPassword(p))
 assert.doesNotThrow(()=>validateNewCrmPassword(' IsolatedPass123 '))
})
test('Davet doğrulanmadan Auth hesabı oluşturulmaz',async()=>{
 const s=setup({rpc:()=>({error:{message:'crm_invite_invalid'}})})
 await assert.rejects(s.service.registerWithInvite('test@example.invalid','IsolatedPass123','invalid','https://app.invalid'),/Davet geçersiz/)
 assert.equal(s.calls.some(c=>c.signup),false)
})
test('Kayıt rol metadata göndermez ve e-posta onayını giriş başarısı saymaz',async()=>{
 const s=setup();const result=await s.service.registerWithInvite(' test@example.invalid ',' IsolatedPass123 ','token','https://app.invalid')
 const signup=s.calls.find(c=>c.signup).signup;assert.equal(signup.password,' IsolatedPass123 ');assert.equal(signup.email,'test@example.invalid')
 assert.deepEqual(signup.options,{emailRedirectTo:'https://app.invalid'});assert.equal(result.confirmationRequired,true)
})
test('Kayıt e-posta kotası Auth başarısı sayılmaz',async()=>{
 const s=setup({signupError:{status:429,code:'over_email_send_rate_limit'}})
 await assert.rejects(s.service.registerWithInvite('test@example.invalid','IsolatedPass123','token','https://app.invalid'),/gönderim sınırı/)
})
test('Davet kabulü doğrulanmış Auth kullanıcısı gerektirir',async()=>{
 const s=setup({noUser:true});await assert.rejects(s.service.acceptInvite(),/sunucu oturumu/);assert.equal(s.calls.length,0)
})
test('Yanlış mevcut parola yeni parolayı güncelleyemez',async()=>{
 const s=setup({wrongPassword:true});await assert.rejects(s.service.changePassword('wrong','NewIsolatedPass123'),/doğrulanamadı/);assert.equal(s.calls.some(c=>c.update),false)
})
test('Parola değişiminde Auth e-postası ve aynı kullanıcı kontrol edilir',async()=>{
 const s=setup();await s.service.changePassword(' OldPass123 ',' NewIsolatedPass123 ')
 assert.equal(s.calls.find(c=>c.reauth).reauth.email,'auth@example.invalid')
 assert.deepEqual(s.calls.find(c=>c.update).update,{password:' NewIsolatedPass123 ',current_password:' OldPass123 '})
 assert.equal(s.calls.some(c=>c.args?.password),false)
})
test('Yeniden giriş başka kimlik döndürürse parola değişmez',async()=>{
 const s=setup({differentUser:true});await assert.rejects(s.service.changePassword('OldPass123','NewIsolatedPass123'));assert.equal(s.calls.some(c=>c.update),false)
})
test('Kurtarma olayı ve etkin profil olmadan kurtarma parolası yazılmaz',async()=>{
 const s=setup();await assert.rejects(s.service.completePasswordRecovery('NewIsolatedPass123',false),/kurtarma bağlantısı/)
 assert.equal(s.calls.some(c=>c.update),false)
 const disabled=setup({noProfile:true});await assert.rejects(disabled.service.completePasswordRecovery('NewIsolatedPass123',true));assert.equal(disabled.calls.some(c=>c.update),false)
})
test('Bozuk kalıcılık cevabı başarı sayılmaz',async()=>{
 const s=setup({rpc:()=>({data:{note:'not enough'}})});await assert.rejects(s.service.saveProbe('request',0,'note'),/başarı kabul edilmedi/)
})
test('İlk parola doğrulanmış davet ve etkin CRM profili gerektirir',async()=>{
 for(const options of [{},{userFields:{invited_at:'2026-11-05'}},{noProfile:true,userFields:{invited_at:'2026-11-05',email_confirmed_at:'2026-11-05'}}]){
  const s=setup(options);await assert.rejects(s.service.completeInvitationPassword('NewIsolatedPass123'));assert.equal(s.calls.some(c=>c.update),false)
 }
 const s=setup({userFields:{invited_at:'2026-11-05',email_confirmed_at:'2026-11-05'}})
 await s.service.completeInvitationPassword('NewIsolatedPass123');assert.deepEqual(s.calls.find(c=>c.update).update,{password:'NewIsolatedPass123'})
})
test('İlk parola sunucu reddini başarı saymaz',async()=>{
 const s=setup({userFields:{invited_at:'2026-11-05',email_confirmed_at:'2026-11-05'},updateError:true})
 await assert.rejects(s.service.completeInvitationPassword('NewIsolatedPass123'),/kaydedilemedi/)
})

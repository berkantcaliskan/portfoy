import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCrmAuthService,parseCrmProfile,crmEmailError} from '../src/services/crmAuthService.ts'
const raw={auth_user_id:'auth-id',id:'employee',full_name:'İzole Kullanıcı',username:'isolated',department:'Pazarlama',departments:['Pazarlama'],role:'MEMBER',scope:'ASSIGNED_ONLY',permissions:{canSend:false},password:'must-not-return'}
test('E-posta limit ve sağlayıcı hataları ayırt edilir; ham hata metni gösterilmez',()=>{
 assert.equal(crmEmailError({status:429,code:'over_email_send_rate_limit'}).code,'email_rate_limited')
 assert.equal(crmEmailError({status:429,code:'over_request_rate_limit'}).code,'request_rate_limited')
 assert.equal(crmEmailError({code:'email_address_not_authorized'}).code,'email_not_authorized')
 assert.equal(crmEmailError({code:'email_provider_disabled'}).code,'email_disabled')
 assert.equal(crmEmailError({code:'private@example.invalid'}).message.includes('private@example.invalid'),false)
})
function setup(options:any={}){
 const calls:any[]=[]
 const client:any={auth:{getUser:async()=>({data:{user:options.noUser?null:{id:'auth-id',user_metadata:{role:'ADMIN'}}},error:null}),
 signInWithPassword:async(input:any)=>{calls.push({signIn:input});return {error:options.loginError?{}:null}},
 signInWithOtp:async(input:any)=>{calls.push({otp:input});return {error:options.loginError?{}:null}},
 verifyOtp:async(input:any)=>{calls.push({verify:input});return {error:options.loginError?{}:null}},
 signOut:async()=>{calls.push({signOut:true});return {error:null}}},
 rpc:async()=>{calls.push({profileRead:true});return {data:options.profile||raw,error:options.profileError?{}:null}}}
 return {auth:createCrmAuthService(client),calls}
}
test('Merkezi profil parola içermez ve Auth metadata rolünü kullanmaz',async()=>{
 const s=setup(),p=await s.auth.getProfile();assert.equal(p.role,'MEMBER');assert.equal('password' in p,false)
})
test('Sunucuda oturumu olmayan kullanıcı profil alamaz',async()=>{
 const s=setup({noUser:true});await assert.rejects(s.auth.getProfile(),/Sunucu oturumu/);assert.equal(s.calls.length,0)
})
test('Personel eşlemesi bulunmayan giriş yerel oturumu kapatır',async()=>{
 const s=setup({profileError:true});await assert.rejects(s.auth.signInWithPassword('test@example.invalid','isolated-password'),/personeli/)
 assert.equal(s.calls.some(c=>c.signOut),true)
})
test('Başka Auth kullanıcısına ait profil reddedilir',()=>assert.throws(()=>parseCrmProfile({...raw,auth_user_id:'other'},'auth-id'),/doğrulanamadı/))
test('Bilinmeyen rol ve kapsam reddedilir',()=>{assert.throws(()=>parseCrmProfile({...raw,role:'ROOT'},'auth-id'));assert.throws(()=>parseCrmProfile({...raw,scope:'UNLIMITED'},'auth-id'))})
test('Parola normalize edilmez; e-posta kenar boşluğu temizlenir',async()=>{
 const s=setup();await s.auth.signInWithPassword(' test@example.invalid ',' pass ');assert.deepEqual(s.calls[0].signIn,{email:'test@example.invalid',password:' pass '})
})
test('Başarısız giriş profil RPC çalıştırmaz',async()=>{
 const s=setup({loginError:true});await assert.rejects(s.auth.signInWithPassword('test@example.invalid','bad'),/reddedildi/)
 assert.equal(s.calls.some(c=>c.profileRead),false)
})
test('Kod isteği yeni kullanıcı oluşturmaz veya istemciden rol atamaz',async()=>{
 const s=setup();await s.auth.requestCode(' test@example.invalid ')
 assert.deepEqual(s.calls[0].otp,{email:'test@example.invalid',options:{shouldCreateUser:false}})
 assert.equal(s.calls.some(c=>c.profileRead),false)
})
test('Kod doğrulaması sunucu profilini almadan yetki sağlamaz',async()=>{
 const s=setup({profileError:true});await assert.rejects(s.auth.verifyCode('test@example.invalid','123456'),/personeli/)
 assert.equal(s.calls.some(c=>c.signOut),true)
})
test('Yanlış kod profil okumaz',async()=>{
 const s=setup({loginError:true});await assert.rejects(s.auth.verifyCode('test@example.invalid','bad'),/doğrulanamadı/)
 assert.equal(s.calls.some(c=>c.profileRead),false)
})
test('Bağlantı girişi backend dönüş adresini korur; hesap oluşturmaz',async()=>{
 const s=setup();await s.auth.requestCode('test@example.invalid','http://127.0.0.1:9002/?workspace=backend')
 assert.deepEqual(s.calls[0].otp.options,{shouldCreateUser:false,emailRedirectTo:'http://127.0.0.1:9002/?workspace=backend'})
})

import type {SupabaseClient} from '@supabase/supabase-js'
import {createCrmAuthService,crmEmailError,CrmAuthError,parseCrmProfile} from './crmAuthService.ts'

export function validateNewCrmPassword(password:string){
 if(password.length<12||password.length>128)throw new CrmAuthError('weak_password','Parola 12–128 karakter olmalı.')
 if(!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password)||!/[0-9]/.test(password))throw new CrmAuthError('weak_password','Parola en az bir harf ve bir rakam içermeli.')
}
const errors:Record<string,string>={crm_admin_required:'Personel daveti için sunucuda yönetici yetkisi gerekli.',crm_invite_invalid:'Davet geçersiz, süresi dolmuş veya bu e-postaya ait değil.',crm_invite_already_pending:'Bu e-posta için bekleyen bir davet var.',crm_identity_already_assigned:'Bu hesaba zaten personel atanmış.',crm_email_confirmation_required:'Önce e-posta adresinizi doğrulayın.',crm_rate_limited:'Davet oluşturma sınırına ulaşıldı.',crm_revision_conflict:'Deneme kaydı başka bir oturumda değişmiş; sunucudan yeniden okuyun.',crm_request_conflict:'İşlem kimliği başka bir değişiklik için kullanılmış.'}
export function createCrmAccountService(client:SupabaseClient){
 const auth=createCrmAuthService(client)
 const rpc=async(name:string,args:Record<string,unknown>={})=>{
  const {data,error}=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000))
  if(error){const code=Object.keys(errors).find(k=>error.message?.includes(k));throw new CrmAuthError(code||'account_failed',code?errors[code]:'Sunucu hesabı işlemi tamamlanamadı; yetki ve oturumu kontrol edin.')}
  return data
 }
 return {
  async registerWithInvite(email:string,password:string,token:string,redirectTo:string){
   validateNewCrmPassword(password)
   await rpc('crm_check_staff_invite',{p_token:token,p_email:email.trim()})
   // Metadata'da rol veya personel ID'si verilmez. Yetki davet kabul RPC'sinden gelir.
   const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}})
   if(error)throw crmEmailError(error)
   // E-posta onayı gerekiyorsa kayıt başarılı olsa da uygulama oturumu hazır değildir.
   return {confirmationRequired:!data.session}
  },
  async acceptInvite(token?:string){
   const {data,error}=await client.auth.getUser()
   if(error||!data.user)throw new CrmAuthError('authentication_required','Davet kabulü için e-posta doğrulaması ve sunucu oturumu gerekli.')
   return parseCrmProfile(await rpc('crm_accept_staff_invite',{p_token:token||null}),data.user.id)
  },
  async createInvite(input:{email:string;fullName:string;department:string;role:string;scope:string}){
   const result=await rpc('crm_create_staff_invite',{p_email:input.email.trim(),p_name:input.fullName,p_department:input.department,p_role:input.role,p_scope:input.scope})
   if(typeof result?.token!=='string'||typeof result?.id!=='string')throw new CrmAuthError('invalid_response','Davet sonucu doğrulanamadı.')
   return result as {id:string;token:string;expires_at:string}
  },
  async revokeInvite(id:string){await rpc('crm_revoke_staff_invite',{p_id:id})},
  async requestPasswordReset(email:string,redirectTo:string){
   const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo})
   if(error)throw crmEmailError(error)
  },
  async changePassword(currentPassword:string,newPassword:string){
   validateNewCrmPassword(newPassword)
   const profile=await auth.getProfile()
   const {data:identity,error}=await client.auth.getUser()
   if(error||!identity.user?.email)throw new CrmAuthError('authentication_required','Sunucu kimliği doğrulanamadı.')
   const {data:reauth,error:reauthError}=await client.auth.signInWithPassword({email:identity.user.email,password:currentPassword})
   if(reauthError||reauth.user?.id!==profile.authUserId)throw new CrmAuthError('reauthentication_failed','Mevcut Supabase parolası doğrulanamadı; parola değiştirilmedi.')
   const {error:updateError}=await client.auth.updateUser({password:newPassword,current_password:currentPassword})
   if(updateError)throw new CrmAuthError('password_update_failed','Parola güncellenemedi; sunucu parola kurallarını kontrol edin.')
   if (profile.mustChangePassword) {
    await rpc('crm_finish_initial_password')
   }
  },
  async completePasswordRecovery(newPassword:string,recoveryEventReceived:boolean){
   if(!recoveryEventReceived)throw new CrmAuthError('recovery_required','Supabase parola kurtarma bağlantısıyla açılmış oturum gerekli.')
   validateNewCrmPassword(newPassword)
   await auth.getProfile()
   const {error}=await client.auth.updateUser({password:newPassword})
   if(error)throw new CrmAuthError('password_update_failed','Parola yenilenemedi; kurtarma oturumunu ve sunucu kurallarını kontrol edin.')
  },
  async completeInvitationPassword(newPassword:string){
   validateNewCrmPassword(newPassword)
   await auth.getProfile()
   const {data,error}=await client.auth.getUser()
   if(error||!data.user?.invited_at||!data.user.email_confirmed_at)throw new CrmAuthError('invitation_required','Önce e-postadaki hesap davetini doğrulayın.')
   const {error:updateError}=await client.auth.updateUser({password:newPassword})
   if(updateError)throw new CrmAuthError('password_update_failed','İlk parola kaydedilemedi; davet oturumunu ve sunucu parola kurallarını kontrol edin.')
  },
  async readProbe(){const data=await rpc('crm_get_persistence_probe');return data===null?null:parseProbe(data)},
  async saveProbe(requestId:string,revision:number,note:string){return parseProbe(await rpc('crm_save_persistence_probe',{p_request:requestId,p_revision:revision,p_note:note}))},
 }
}
function parseProbe(data:any):{note:string;revision:number;updated_at:string}{
 if(!data||typeof data.note!=='string'||!Number.isSafeInteger(data.revision)||data.revision<1||typeof data.updated_at!=='string')throw new CrmAuthError('invalid_response','Sunucu kalıcılık sonucu doğrulanamadı; başarı kabul edilmedi.')
 return {note:data.note,revision:data.revision,updated_at:data.updated_at}
}

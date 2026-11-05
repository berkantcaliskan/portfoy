import type {SupabaseClient} from '@supabase/supabase-js'
import type {Department,UserRole,AccessScope,UserPermissions} from '@/types/department'

export interface CrmAuthProfile {
 authUserId:string; id:string; fullName:string; username:string; email?:string;
 department:Department; departments:Department[]; role:UserRole; scope:AccessScope;
 companyName:string; isManager:boolean; permissions:UserPermissions; createdAt:string;
}
export class CrmAuthError extends Error {
 code:string
 constructor(code:string,message:string){super(message);this.code=code}
}
export function crmEmailError(error:{code?:string;status?:number}):CrmAuthError{
 const code=error.code
 if(code==='over_email_send_rate_limit')return new CrmAuthError('email_rate_limited','Supabase e-posta gönderim sınırı doldu (Auth over_email_send_rate_limit, HTTP 429). Yeni istek göndermeyin; sınırın yenilenmesi veya sunucuda özel SMTP yapılandırılması gerekiyor.')
 if(code==='over_request_rate_limit'||error.status===429)return new CrmAuthError('request_rate_limited','Giriş isteği hız sınırına ulaşıldı (HTTP 429). Yeni istek göndermeden bekleyin.')
 if(code==='email_provider_disabled')return new CrmAuthError('email_disabled','Sunucuda e-posta ile giriş kapalı.')
 if(code==='email_address_not_authorized')return new CrmAuthError('email_not_authorized','Varsayılan e-posta servisi bu alıcıya gönderim yapamıyor; sunucuda özel SMTP yapılandırılmalı.')
 const safeCode=typeof code==='string'&&/^[a-z_]{1,60}$/.test(code)?code:'unknown'
 const status=Number.isInteger(error.status)?String(error.status):'unknown'
 return new CrmAuthError('code_failed',`Giriş e-postası gönderilemedi (Auth ${safeCode}, HTTP ${status}).`)
}
const roles=['ADMIN','MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER']
const departments=['Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim']
const scopes=['ALL','DEPARTMENT','ASSIGNED_ONLY']
export function parseCrmProfile(raw:any,authUserId:string):CrmAuthProfile {
 if(!raw||raw.auth_user_id!==authUserId||typeof raw.id!=='string'||!raw.id||typeof raw.full_name!=='string'
  ||typeof raw.username!=='string'||!roles.includes(raw.role)||!departments.includes(raw.department)||!scopes.includes(raw.scope)) {
  throw new CrmAuthError('invalid_profile','Sunucu personel profili doğrulanamadı.')
 }
 return {authUserId,id:raw.id,fullName:raw.full_name,username:raw.username,email:typeof raw.email==='string'?raw.email:undefined,
  department:raw.department,departments:Array.isArray(raw.departments)?raw.departments.filter((v:any)=>departments.includes(v)):[],
  role:raw.role,scope:raw.scope,companyName:typeof raw.company_name==='string'?raw.company_name:'',isManager:raw.is_manager===true,
  permissions:raw.permissions&&typeof raw.permissions==='object'&&!Array.isArray(raw.permissions)?Object.fromEntries(Object.entries(raw.permissions).filter(([,v])=>typeof v==='boolean')):{},
  createdAt:typeof raw.created_at==='string'?raw.created_at:''}
}

/** Genel CRM geçişinde kullanılacak adaptör. Mevcut Meta oturumu veya yerel giriş otomatik değiştirilmez. */
export function createCrmAuthService(client:SupabaseClient){
 const getProfile=async():Promise<CrmAuthProfile>=>{
  // Yerel depodaki user/role veya Auth metadata'sı yetki kaynağı değildir.
  const {data:identity,error:authError}=await client.auth.getUser()
  if(authError||!identity.user) throw new CrmAuthError('authentication_required','Sunucu oturumu gerekli.')
  const {data,error}=await client.rpc('crm_get_my_profile')
  if(error) throw new CrmAuthError('identity_not_assigned','Bu hesaba etkin CRM personeli atanmamış veya profil okunamadı.')
  return parseCrmProfile(data,identity.user.id)
 }
 return {getProfile,
  async requestCode(email:string,redirectTo?:string){
   if(!email.trim())throw new CrmAuthError('credentials_required','E-posta gerekli.')
   const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,...(redirectTo?{emailRedirectTo:redirectTo}:{})}})
   if(error)throw crmEmailError(error)
  },
  async verifyCode(email:string,token:string){
   if(!email.trim()||!token.trim())throw new CrmAuthError('credentials_required','E-posta ve kod gerekli.')
   const {error}=await client.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email'})
   if(error)throw new CrmAuthError('verification_failed','Kod doğrulanamadı veya süresi doldu.')
   try{return await getProfile()}
   catch(error){await client.auth.signOut({scope:'local'});throw error}
  },
  async signInWithPassword(email:string,password:string){
   if(!email.trim()||!password) throw new CrmAuthError('credentials_required','E-posta ve parola gerekli.')
   const {error}=await client.auth.signInWithPassword({email:email.trim(),password})
   if(error) throw new CrmAuthError('sign_in_failed','Sunucu girişi reddedildi. E-posta ve parolayı kontrol edin.')
   try{return await getProfile()}
   catch(error){await client.auth.signOut({scope:'local'});throw error}
  },
  async signOut(){const {error}=await client.auth.signOut({scope:'local'});if(error)throw new CrmAuthError('sign_out_failed','Sunucu oturumu kapatılamadı.')},
 }
}

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

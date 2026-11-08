import type {CrmAuthProfile} from './crmAuthService.ts'

/** Ana ekran kimliği yalnızca sunucuda doğrulanmış profilden gelir. */
export function createCrmMainSession(auth:{getProfile:()=>Promise<CrmAuthProfile>;signInWithPassword:(email:string,password:string)=>Promise<CrmAuthProfile>;signOut:()=>Promise<void>},publish:(profile:CrmAuthProfile|null)=>void){
 let generation=0
 return {
  async restore(){const ticket=++generation;try{const p=await auth.getProfile();if(ticket===generation)publish(p)}catch{if(ticket===generation)publish(null)}},
  async login(email:string,password:string){const ticket=++generation;publish(null);try{const p=await auth.signInWithPassword(email,password);if(ticket!==generation)throw Error('Giriş sırasında oturum değişti. Yeniden deneyin.');publish(p);return p}catch(e){if(ticket===generation)publish(null);throw e}},
  invalidate(){generation++;publish(null)},
  async logout(){generation++;publish(null);await auth.signOut()},
 }
}

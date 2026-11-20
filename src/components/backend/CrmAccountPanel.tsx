import React,{useMemo,useState,useEffect,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {createCrmAccountService} from '../../services/crmAccountService'
import {createCrmAuthService,type CrmAuthProfile} from '../../services/crmAuthService'
import {createBackendPreviewClient,hasBackendInvitationCallback} from '../../services/crmBackendClient'

const inviteDepartments = ['Müşteri İlişkileri', 'Satış', 'Pazarlama', 'Kreatif', 'Muhasebe', 'Yönetim']

export function CrmAccountPanel({client,profile,borrowed,onAuthenticated}:{client:SupabaseClient;profile:CrmAuthProfile|null;borrowed:boolean;onAuthenticated:(client:SupabaseClient,profile:CrmAuthProfile)=>void}){
 const account=useMemo(()=>createCrmAccountService(client),[client])
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmation,setConfirmation]=useState('')
 const [probeNote,setProbeNote]=useState(''),[probe,setProbe]=useState<{note:string;revision:number;updated_at:string}|null>(null)
 const [pendingProbe,setPendingProbe]=useState<{id:string;revision:number;note:string}|null>(null)
 const [isRecovery,setIsRecovery]=useState(false)
 const [invitationCompleted,setInvitationCompleted]=useState(false)
 const [newInvite,setNewInvite]=useState('')
 const isInvitation=hasBackendInvitationCallback(client)&&!invitationCompleted
 const returnUrl=()=>{const u=new URL(window.location.pathname,window.location.origin);u.searchParams.set('workspace','backend');return u.href}

 useEffect(()=>{setProbe(null);setProbeNote('');setPendingProbe(null);setNewInvite('')},[client,profile?.authUserId])
 useEffect(()=>{const {data}=client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setIsRecovery(true);else if(event==='SIGNED_OUT')setIsRecovery(false)});return()=>data.subscription.unsubscribe()},[client])
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await fn()}catch(e){setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.')}finally{setBusy(false);setPassword('');setNewPassword('');setConfirmation('')}}
 const checkConfirmation=()=>{if(newPassword!==confirmation)throw Error('Yeni parola ve tekrarı eşleşmiyor.')}
 const button='border rounded-xl px-4 py-2 disabled:opacity-40'
 const input='block w-full border rounded-xl p-3 mt-1'
 const createInvite = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  const fields = new FormData(event.currentTarget)
  setNewInvite('')
  void run(async () => {
   const invite = await account.createInvite({
    email: String(fields.get('email')), fullName: String(fields.get('name')),
    department: String(fields.get('department')), role: 'MEMBER', scope: String(fields.get('scope')),
   })
   setNewInvite(invite.token)
   setMessage('Davet oluşturuldu. Kodu yalnızca davet ettiğiniz kişiyle paylaşın.')
  })
 }
 return <section className="bg-white border rounded-3xl p-6 space-y-5">
  <h2 className="font-bold">Hesap güvenliği ve kalıcılık</h2>
  {!profile&&<div className="space-y-3">
   <h3 className="font-semibold">E-posta ve Supabase parolasıyla giriş</h3>
   <label className="block">E-posta<input className={input} type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="block">Parola<input className={input} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button disabled={busy} className={button} onClick={()=>void run(async()=>{const next=createBackendPreviewClient();const p=await createCrmAuthService(next).signInWithPassword(email,password);onAuthenticated(next,p);setMessage('Sunucu girişiniz doğrulandı.')})}>Parolayla giriş yap</button>
   <button disabled={busy} className={button} onClick={()=>void run(async()=>{await account.requestPasswordReset(email,returnUrl());setMessage('Hesap uygunsa parola yenileme bağlantısı gönderildi.')})}>Parolamı unuttum</button>
   <p className="text-sm">Personel hesabını yöneticiniz kullanıcı adı ve geçici parolayla oluşturur.</p>
  </div>}
  {profile&&<div className="space-y-3">
   <h3 className="font-semibold">Supabase parolası</h3>
   {borrowed?<p className="text-sm">Bu oturum mevcut Meta girişinden yalnızca okunan JWT ile doğrulandı. Parola işlemi için bu alandan çıkıp e-posta/parola veya kurtarma bağlantısıyla bağımsız giriş yapın.</p>:<>
    {!isInvitation&&<label className="block">Mevcut Supabase parolası<input className={input} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    <label className="block">Yeni parola<input className={input} type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <label className="block">Yeni parola tekrarı<input className={input} type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    {isInvitation?<button disabled={busy} className={button} onClick={()=>void run(async()=>{checkConfirmation();await account.completeInvitationPassword(newPassword);setInvitationCompleted(true);setMessage('İlk parolanız Supabase Auth üzerinde kaydedildi. Bundan sonra e-posta ve parolanızla giriş yapabilirsiniz.')})}>İlk parolamı belirle</button>:<button disabled={busy} className={button} onClick={()=>void run(async()=>{checkConfirmation();await account.changePassword(password,newPassword);setMessage('Parola Supabase Auth üzerinde güncellendi; yerel personel kaydına yazılmadı.')})}>Mevcut parolayı doğrula ve değiştir</button>}
    {isRecovery&&<button disabled={busy} className={button} onClick={()=>void run(async()=>{checkConfirmation();await account.completePasswordRecovery(newPassword,isRecovery);setIsRecovery(false);setMessage('Doğrulanmış Auth kurtarma oturumunda yeni parola kaydedildi.')})}>Kurtarma bağlantısından sonra yeni parolayı kaydet</button>}
   </>}
   <h3 className="font-semibold pt-3">Sunucuda kalıcılık denemesi</h3><p className="text-sm">Bu not müşteri/proje verisinden ayrı, yalnızca hesabınıza ait deneme kaydıdır. Sayfayı yeniledikten sonra yeniden doğrulanıp “Sunucudan oku”ya basın.</p>
   <label className="block">Deneme notu<input className={input} maxLength={200} value={probeNote} onChange={e=>setProbeNote(e.target.value)}/></label>
   <button disabled={busy} className={button} onClick={()=>void run(async()=>{const value=await account.readProbe();setProbe(value);setProbeNote(value?.note||'');setPendingProbe(null);setMessage(value?'Deneme notu doğrudan sunucudan okundu.':'Bu hesap için henüz deneme notu yok.')})}>Sunucudan oku</button>
   <button disabled={busy} className={button} onClick={()=>void run(async()=>{const command=pendingProbe||{id:crypto.randomUUID(),revision:probe?.revision||0,note:probeNote};setPendingProbe(command);const saved=await account.saveProbe(command.id,command.revision,command.note);setProbe(saved);setPendingProbe(null);setMessage('Deneme notu sunucuda kaydedildi. Yenileme sonrası yeniden okuyarak kalıcılığı doğrulayın.')})}>{pendingProbe?'Aynı işlemi tekrar kontrol et':'Deneme notunu sunucuya kaydet'}</button>
   {probe&&<p className="text-sm">Sunucu kaydı: {probe.note} · Sürüm {probe.revision} · {probe.updated_at}</p>}
  </div>}
  {profile?.role === 'ADMIN' && <p>Personel hesaplarını ana uygulamadaki Ekip ve Yetkiler ekranından yönetebilirsiniz.</p>}
  {profile?.role === 'ADMIN' && !profile.mustChangePassword && !borrowed && (
   <form className="space-y-3" onSubmit={createInvite}>
    <h3 className="font-semibold">Personel kayıt daveti</h3>
    <label className="block">Ad soyad<input className={input} name="name" required minLength={2} maxLength={150}/></label>
    <label className="block">Personel e-postası<input className={input} name="email" required type="email" maxLength={254}/></label>
    <label className="block">Departman<select className={input} name="department">{inviteDepartments.map(department => <option key={department}>{department}</option>)}</select></label>
    <label className="block">Erişim kapsamı
     <select className={input} name="scope" defaultValue="ASSIGNED_ONLY">
      <option value="ASSIGNED_ONLY">Yalnızca atanan kayıtlar</option>
      <option value="DEPARTMENT">Departman kayıtları</option>
     </select>
    </label>
    <button className={button} disabled={busy}>Davet kodu oluştur</button>
    {newInvite && <code className="block break-all select-all">{newInvite}</code>}
   </form>
  )}
  <p role="status" aria-live="polite" className="text-sm text-[#705432]">{busy?'İşlem sürüyor…':message}</p>
 </section>
}

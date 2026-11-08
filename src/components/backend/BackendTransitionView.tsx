import React,{useState,useEffect,useMemo} from 'react'
import {createBackendPreviewClient,createBackendClientFromExistingSession} from '../../services/crmBackendClient'
import {createCrmAuthService,type CrmAuthProfile} from '../../services/crmAuthService'
import {createCrmBackendRepository,CRM_BACKEND_MODULES} from '../../services/crmBackendRepository'
import {previewCrmMigration,type MigrationPreview} from '../../services/crmMigrationPreview'
import {CrmAccountPanel} from './CrmAccountPanel'

const labels:Record<string,string>={projects:'Projeler ve daireler',appointments:'Randevular',requests:'Müşteri talepleri',collections:'Tahsilatlar',payments:'Ödemeler',approvals:'Onaylar',files:'Dosya kayıtları'}
export default function BackendTransitionView(){
 const [client,setClient]=useState(createBackendPreviewClient)
 const [borrowed,setBorrowed]=useState(false)
 const auth=useMemo(()=>createCrmAuthService(client),[client])
 const repository=useMemo(()=>createCrmBackendRepository(client),[client])
 const [profile,setProfile]=useState<CrmAuthProfile|null>(null)
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Sunucu kimliğinizi doğrulayın. Bu alan kayıt taşımaz veya silmez.')
 const [preview,setPreview]=useState<MigrationPreview[]>([]),[counts,setCounts]=useState<Record<string,string>>({})
 useEffect(()=>{let live=true;void auth.getProfile().then(p=>{if(live){setProfile(p);setMessage('Sunucu personel profili doğrulandı.')}},e=>{if(live&&e?.code!=='authentication_required')setMessage(e instanceof Error?e.message:'Sunucu kimliği doğrulanamadı.')});return()=>{live=false}},[auth])
 const action=async(run:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await run()}catch(e){setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.')}finally{setBusy(false)}}
 const readBackend=async()=>{
  if(!profile)return
  const found:Record<string,string>={}
  for(const module of CRM_BACKEND_MODULES){try{const result=await repository.list(module);found[module]=`${result.records.length}${result.next?'+':''} erişilebilir kayıt`}catch(e){found[module]=e instanceof Error?e.message:'Okunamadı'}}
  setCounts(found);setMessage('Sunucu listeleri kontrol edildi. Hiçbir yerel kayıt yüklenmedi; her satırın sonucunu ayrı inceleyin.')
 }
 return <main className="min-h-screen bg-[#f5f5f2] text-[#292d2b] p-6 sm:p-10"><div className="max-w-5xl mx-auto space-y-6">
  <header className="flex justify-between gap-4 items-start"><div><h1 className="text-2xl font-bold">Merkezi backend geçişi</h1><p className="mt-2 text-sm">Yeni kullanım için kimlik, yetki ve kalıcılık kontrolü</p></div><a className="underline" href="/">Mevcut CRM’e dön</a></header>
  <section className="bg-white border rounded-3xl p-6 space-y-4">
   <p>Bu geçiş alanı mevcut CRM’in girişini ve kayıtlarını değiştirmez. Meta alanı korunur. Buradan toplu aktarım veya üretim aktivasyonu yapılmaz.</p>
   {profile?<><p>Sunucuda doğrulandı: <strong>{profile.fullName}</strong> · {profile.role} · {profile.department}</p><button disabled={busy} className="border rounded-xl px-4 py-2" onClick={()=>void action(async()=>{if(!borrowed)await auth.signOut();setBorrowed(false);setClient(createBackendPreviewClient());setProfile(null);setPreview([]);setCounts({});setMessage('Geçiş alanı oturumu kapandı.')})}>Bu alandan çıkış yap</button></>:<div className="space-y-3">
    <button disabled={busy} className="bg-[#6468c8] text-white rounded-xl px-4 py-2" onClick={()=>void action(async()=>{const next=createBackendClientFromExistingSession();const p=await createCrmAuthService(next).getProfile();setClient(next);setBorrowed(true);setProfile(p);setMessage('Mevcut Supabase oturumu sunucuda doğrulandı. E-posta gönderilmedi; Meta oturumu değiştirilmedi.')})}>Mevcut Supabase oturumunu doğrula</button>
    <p className="text-sm">Bu tarayıcıda Meta için daha önce sunucuya giriş yaptıysanız yeniden e-posta almadan kimliğiniz doğrulanabilir. Yerel kullanıcı adı/parola yeterli değildir.</p>
    <label className="block">Yetkili e-posta<input autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="block border rounded-xl p-3 w-full mt-1"/></label>
    <button disabled={busy} onClick={()=>void action(async()=>{const redirect=new URL(window.location.pathname,window.location.origin);redirect.searchParams.set('workspace','backend');await auth.requestCode(email,redirect.href);setMessage('Hesap uygunsa giriş e-postası gönderildi. E-postadaki Sign in bağlantısını aynı tarayıcıda açın; kod geldiyse aşağıya girin. Yeni hesap oluşturulmaz.')})} className="bg-[#6468c8] text-white rounded-xl px-4 py-2">Giriş bağlantısı / kodu iste</button>
    <p className="text-sm">E-postada “Sign in” bağlantısı varsa ona tıklayın; kod alanını boş bırakabilirsiniz. Giriş bağlantısı sizi bu geçiş ekranına döndürmelidir.</p>
    <button disabled={busy} className="border rounded-xl px-4 py-2" onClick={()=>void action(async()=>{setProfile(await auth.getProfile());setMessage('Sunucu kimliği doğrulandı.')})}>Oturumu kontrol et</button>
    <label className="block">Yalnızca e-postada sayısal kod geldiyse<input autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} className="block border rounded-xl p-3 w-full mt-1"/></label>
    <button disabled={busy} onClick={()=>void action(async()=>{const p=await auth.verifyCode(email,code);setProfile(p);setCode('');setMessage('Sunucu personel profili doğrulandı.')})} className="bg-[#6468c8] text-white rounded-xl px-4 py-2">Kimliği doğrula</button>
   </div>}
   <p role="status" aria-live="polite" className="text-sm text-[#705432]">{busy?'İşlem sürüyor…':message}</p>
  </section>
  <CrmAccountPanel client={client} profile={profile} borrowed={borrowed} onAuthenticated={(next,p)=>{setClient(next);setBorrowed(false);setProfile(p)}}/>
  <section className="bg-white border rounded-3xl p-6 space-y-4"><h2 className="font-bold">Kayıt durumu kontrolü</h2><p className="text-sm">Yeni kullanım sıfırdan başlayacak; eski profildeki test proje ve dosyaları taşınmayacak. Bu bölüm yalnızca kayıt sayılarını okur. Sunucudaki sayı yalnızca erişebildiğiniz kayıtları gösterir.</p>
   <div className="flex gap-3 flex-wrap"><button disabled={busy||!profile||profile.role!=='ADMIN'} className="border rounded-xl px-4 py-2 disabled:opacity-40" onClick={()=>void action(async()=>{setPreview(await previewCrmMigration(localStorage));setMessage('Yerel önizleme hazır. Hiçbir veri sunucuya gönderilmedi.')})}>Yerel kayıt sayımını göster</button><button disabled={busy||!profile} className="border rounded-xl px-4 py-2 disabled:opacity-40" onClick={()=>void action(readBackend)}>Sunucu kayıtlarını kontrol et</button></div>
   <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Modül</th><th className="p-2">Yerel kayıt</th><th className="p-2">Ön kontrol</th><th className="p-2">Sunucu</th></tr></thead><tbody>{CRM_BACKEND_MODULES.map(module=>{const row=preview.find(p=>p.module===module);return <tr key={module} className="border-t"><td className="p-2">{labels[module]}</td><td className="p-2">{row?.count??'Kontrol edilmedi'}</td><td className="p-2">{row?(row.valid?'Kimlik yapısı uygun':row.error||`${row.missingIds} eksik, ${row.duplicateIds} tekrarlı kimlik`):'Kontrol edilmedi'}</td><td className="p-2">{counts[module]||'Kontrol edilmedi'}</td></tr>})}</tbody></table></div>
  </section>
 </div></main>
}

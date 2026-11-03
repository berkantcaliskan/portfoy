import React, { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { metaStore, invokeMeta } from '@/services/metaStore'
import { supabase } from '@/services/supabaseClient'
import { permissionService } from '@/services/permissionService'
import { userStore } from '@/services/userStore'
import { leadStore } from '@/services/leadStore'
import { STAGE_CONFIGS } from '@/types/lead'
import { stageEvent } from '../../../supabase/functions/_shared/meta-core'
import { getMetaSourceChoices } from '@/services/metaSources'

export function MetaBackendPanel() {
  const [status, setStatus] = useState<Record<string, any> | null>(null)
  const [message, setMessage] = useState('Sunucu bağlantısı ve canlı webhook teslimi henüz doğrulanmadı.')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [leadId, setLeadId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [busy, setBusy] = useState(false)
  const canManage = permissionService.canManageMetaConfig(userStore.getCurrentUser())
  const testLeads = leadStore.getAllRaw().filter(l => l.metaRevision !== undefined && stageEvent[l.stage] &&
    (l.metaLeadId || l.inquiries?.some(i => i.metaLeadgenId)))
  const testSources = getMetaSourceChoices(testLeads.find(l=>l.id===leadId))
  const selectedSourceId = testSources.some(s=>s.id===sourceId) ? sourceId : testSources.length===1 ? testSources[0].id : ''
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  const refresh = async () => { const data = await metaStore.refreshStatus(); setStatus(data); setMessage('Sunucu ayarları okundu. Meta eşleşme, atıf ve optimizasyon sonuçları ayrıca doğrulanmalıdır.') }
  const classes = 'w-full px-3 py-2 rounded-xl bg-[#1e1c1a] border border-[#4a443f] text-xs text-white'
  return <GlassCard className="space-y-4 p-5">
    <h3 className="text-sm font-bold text-white">Meta güvenli sunucu bağlantısı</h3>
    <p className="text-xs text-slate-300">CAPI ve sayfa anahtarları Supabase sunucu sırlarında yönetilir. Tarayıcıya girilmez. Yerel CRM girişi Meta gönderim yetkisi sağlamaz.</p>
    <p className="text-xs text-amber-300" role="status">{message}</p>
    <label className="block text-xs text-slate-300">Webhook adresi
      <input readOnly className={classes} value={metaStore.getConfig().webhookUrl || 'VITE_SUPABASE_URL yapılandırılmalı'} />
    </label>
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Supabase Auth e-posta kodu ile oturum açın. Kullanıcının Meta yetkisi ayrıca yönetici tarafından atanmalıdır.</p>
      <input aria-label="Supabase Auth e-posta" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={classes} placeholder="Yetkili e-posta" />
      <GlassButton disabled={busy || !email} onClick={()=>run(async()=>{
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
        if (error) throw new Error('E-posta kodu gönderilemedi. Supabase Auth ayarlarını kontrol edin.')
        setMessage('E-posta giriş kodu istendi. Posta şablonunda OTP kodu bulunmalıdır.')
      })}>Giriş kodu iste</GlassButton>
      <input aria-label="E-posta doğrulama kodu" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} className={classes} placeholder="E-postadaki kod" />
      <GlassButton disabled={busy || !otp} onClick={()=>run(async()=>{
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
        if (error) throw new Error('Giriş kodu doğrulanamadı.')
        setOtp(''); await refresh()
      })}>Oturumu doğrula</GlassButton>
      <GlassButton disabled={busy} onClick={()=>run(async()=>{
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error('Oturum kapatılamadı.')
        setStatus(null); setMessage('Meta sunucu oturumu kapatıldı.')
      })}>Sunucu oturumunu kapat</GlassButton>
    </div>
    <div className="flex flex-wrap gap-2">
      <GlassButton disabled={busy} onClick={()=>run(refresh)}>Durumu ve geçmişi yenile</GlassButton>
      {canManage && <GlassButton disabled={busy} onClick={()=>run(async()=>{
        const result = await invokeMeta({ action: 'connection' }); setMessage(result.message)
      })}>Yönetici bağlantı testi</GlassButton>}
    </div>
    {status && <div className="text-xs text-slate-300 space-y-2">
      <p>Yapılandırma: {status.configured ? 'Mevcut' : 'Eksik'} • Gönderim: {status.enabled ? 'Açık' : 'Kapalı'} • Güvenli geçiş: {status.securityReady ? 'Yönetici onaylı' : 'Bekleniyor'}</p>
      <p>Dataset: {status.datasetId || 'Eksik'} • Elle gönderim • Arka plan gönderimi kapalı</p>
      <p>API kabulü, Meta eşleşmesi veya reklam optimizasyonu başarısı anlamına gelmez.</p>
      <div className="max-h-60 overflow-auto space-y-2">
        {(status.events || []).map((e: Record<string, any>)=><p key={e.id} className="border-t border-white/10 pt-2">
          {e.event_name} • {{pending:'Bekliyor',processing:'İşleniyor',sent:'Meta API kabul etti',retry:'Tekrar planlandı',rejected:'Kalıcı ret'}[e.state as string]} • Deneme: {e.attempt}
          <br/>Son deneme: {e.last_attempt_at || 'Yok'} • Kabul: {e.sent_at || 'Yok'} {e.error_code && `• Hata: ${e.error_code}`}{e.state !== 'sent' && e.next_attempt_at && ` • En erken tekrar: ${e.next_attempt_at}`}
        </p>)}
      </div>
    </div>}
    {canManage && <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-xs text-amber-300">Test olayı yalnızca sunucuda META_TEST_EVENT_CODE mevcutsa gönderilebilir. Gerçek Meta lead kimlikli, yeni ve uygun aşamadaki müşteri seçin. Sentetik müşteri oluşturulmaz.</p>
      <select aria-label="Test için müşteri seç" className={classes} value={leadId} onChange={e=>setLeadId(e.target.value)}>
        <option value="">Test için müşteri seçin</option>
        {testLeads.map(l => <option key={l.id} value={l.id}>{l.fullName} • {STAGE_CONFIGS[l.stage].label}</option>)}
      </select>
      <select aria-label="Test sonucunun ait olduğu başvuru" className={classes} value={selectedSourceId} onChange={e=>setSourceId(e.target.value)}>
        <option value="">Test için form / başvuru seçin</option>
        {testSources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <GlassButton disabled={busy || !leadId || !selectedSourceId} onClick={()=>run(async()=>{
        const result = await metaStore.sendTestCapiEvent(undefined, leadId, selectedSourceId); setMessage(result.message); if (result.success) await refresh()
      })}>Yalnızca Test Events'e gönder</GlassButton>
    </div>}
  </GlassCard>
}

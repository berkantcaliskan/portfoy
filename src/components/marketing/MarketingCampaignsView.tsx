import React, { useState, useEffect } from 'react'
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Share2,
  TrendingUp,
  Clock,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { metaStore } from '@/services/metaStore'
import { MetaFormSummary, MetaCapiEventLog } from '@/types/meta'

export const MarketingCampaignsView: React.FC = () => {
  const [forms, setForms] = useState<MetaFormSummary[]>(metaStore.getForms())
  const [capiLogs, setCapiLogs] = useState<MetaCapiEventLog[]>(metaStore.getCapiLogs())
  const [metaConfig, setMetaConfig] = useState(() => metaStore.getConfig())
  const [isSimulateOpen, setIsSimulateOpen] = useState(false)

  useEffect(() => {
    const unsub = metaStore.subscribe(() => {
      setForms(metaStore.getForms())
      setCapiLogs(metaStore.getCapiLogs())
      setMetaConfig(metaStore.getConfig())
    })
    return unsub
  }, [])
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadPhone, setNewLeadPhone] = useState('')
  const [selectedFormName, setSelectedFormName] = useState(forms[0]?.name || '')
  const [leadBudget, setLeadBudget] = useState<number>(6500000)
  const [housingType, setHousingType] = useState('2+1 Rezidans')
  const [investmentPurpose, setInvestmentPurpose] = useState('Yatırım & Kira Getirisi')
  const [moveInTiming, setMoveInTiming] = useState('Hemen (1-3 Ay İçinde)')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeadName.trim() || !newLeadPhone.trim()) return

    metaStore.simulateIncomingLead({
      fullName: newLeadName.trim(),
      phone: newLeadPhone.trim(),
      formName: selectedFormName,
      budget: leadBudget,
      preferredHousingType: housingType,
      investmentPurpose,
      moveInTiming,
    })

    setForms(metaStore.getForms())
    setIsSimulateOpen(false)
    setNewLeadName('')
    setNewLeadPhone('')
    setSuccessMsg('Canlı Meta Webhook başarıyla simüle edildi ve müşteri form cevaplarıyla CRM havuzuna işlendi.')
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const totalLeads = forms.reduce((acc, f) => acc + f.leadCount, 0)
  const avgConversion = forms.length > 0 ? Math.round(forms.reduce((acc, f) => acc + f.conversionRate, 0) / forms.length) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Kampanyalar
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Meta Ads (Instagram & Facebook Lead Ads) reklam kampanyaları, form performansları ve canlı webhook veri akışı.
          </p>
        </div>

        <GlassButton
          variant="gold"
          size="sm"
          icon={<Zap className="w-3.5 h-3.5" />}
          onClick={() => setIsSimulateOpen(true)}
          className="rounded-full px-4 text-xs font-semibold"
        >
          Meta Webhook Simülasyonu
        </GlassButton>
      </div>

      {successMsg && (
        <div className="p-3 rounded-[16px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-[#a69f99]">Toplam Kampanya Lead'i</div>
          <div className="text-2xl font-bold text-white mt-1">{totalLeads}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">{forms.length} Aktif Meta Reklam Formu</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-emerald-400">Ortalama Dönüşüm</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">%{avgConversion}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Formdan randevuya dönüşüm</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-sky-400">Dönüşümler API (CAPI) Durumu</div>
          <div className="text-sm font-semibold text-white mt-2 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                metaConfig.datasetId ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {metaConfig.datasetId
              ? `Dataset: ${metaConfig.datasetId}`
              : 'Dataset ID Bekleniyor (Ayarlar > Meta)'}
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">
            {capiLogs.length} CAPI Sinyali • SHA-256 Şifreli CRM Aktarımı
          </div>
        </GlassCard>
      </div>

      {/* Meta Dönüşümler API (CAPI) Son Gönderilen CRM Kalite Sinyalleri */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#b99881]" />
              <span>Meta Dönüşümler API'si (CAPI) — Olumlu / Olumsuz Müşteri Sinyalleri</span>
            </h3>
            <p className="text-xs text-[#a69f99] mt-0.5">
              CRM'de aşaması değişen veya Nitelikli (QualifiedLead) / Olumsuz (DisqualifiedLead) olarak işaretlenen müşterilerin Meta'ya aktarım kaydı.
            </p>
          </div>
          {capiLogs.some((l) => l.status === 'QUEUED') && (
            <GlassButton
              variant="subtle"
              size="sm"
              onClick={() => metaStore.flushQueuedCapiEvents()}
              className="rounded-full px-3.5 text-xs font-semibold"
            >
              Kuyruktaki Sinyalleri Gönder
            </GlassButton>
          )}
        </div>

        {capiLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#8c857f] border border-dashed border-[#4a443f] rounded-2xl">
            Henüz Meta'ya gönderilmiş bir dönüşüm sinyali yok. Müşteri detayından <strong>Olumlu / Nitelikli</strong> veya <strong>Olumsuz</strong> butonuna tıkladığınızda ya da müşteri aşamasını değiştirdiğinizde burada listelenir.
          </div>
        ) : (
          <div className="divide-y divide-[#4a443f]/50 max-h-[220px] overflow-y-auto pr-1">
            {capiLogs.slice(0, 15).map((log) => (
              <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      log.eventName === 'QualifiedLead' || log.eventName === 'Purchase'
                        ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
                        : log.eventName === 'DisqualifiedLead'
                        ? 'bg-rose-500/12 text-rose-400 border-rose-500/30'
                        : 'bg-sky-500/12 text-sky-300 border-sky-500/30'
                    }`}
                  >
                    {log.eventName}
                  </span>
                  <span className="font-bold text-white truncate">{log.leadName}</span>
                  <span className="text-[#8c857f]">•</span>
                  <span className="text-[#d6beae] font-medium">{log.signalLabel}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-[#8c857f] font-mono">
                    {new Date(log.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      log.status === 'SENT'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : log.status === 'QUEUED'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                    title={log.errorMessage || ''}
                  >
                    {log.status === 'SENT' ? 'Meta\'ya İletildi' : log.status === 'QUEUED' ? 'Kuyrukta' : 'Hata'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Kampanya ve Form Kartları */}
      {forms.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Megaphone className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Kayıtlı kampanya bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Henüz tanımlanmış bir reklam kampanyası veya Meta formu bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {forms.map((form) => (
            <GlassCard key={form.id} className="p-5 bg-[#282522] border-[#4a443f] space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-semibold">
                  Instagram & Facebook
                </span>
                <GlassBadge size="sm" variant={form.status === 'ACTIVE' ? 'success' : 'default'}>
                  {form.status === 'ACTIVE' ? 'Aktif' : 'Durduruldu'}
                </GlassBadge>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{form.name}</h3>
                <p className="text-xs text-[#a69f99] mt-0.5">{form.campaignName}</p>
              </div>

              <div className="pt-1 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#8c857f]">Toplam Lead:</span>
                  <span className="text-white font-bold ml-1.5">{form.leadCount}</span>
                </div>
                <div>
                  <span className="text-[#8c857f]">Dönüşüm:</span>
                  <span className="text-emerald-400 font-bold ml-1.5">%{form.conversionRate}</span>
                </div>
              </div>

              <div className="text-[10px] text-[#8c857f]">
                Son Aday: {form.lastLeadAt ? new Date(form.lastLeadAt).toLocaleString('tr-TR') : 'Kayıt yok'}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* WEBHOOK SIMULATE MODAL */}
      <GlassModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        title="Canlı Meta Lead Ads Webhook Simülasyonu"
      >
        <form onSubmit={handleSimulateSubmit} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Instagram veya Facebook reklam formu üzerinden bir kullanıcının formu doldurup gönderdiği senaryoyu simüle edin. Veri doğrudan müşteri havuzuna ve ilgili kampanyaya işlenir.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Meta Reklam Formu *
            </label>
            <select
              value={selectedFormName}
              onChange={(e) => setSelectedFormName(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            >
              {forms.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Aday Adı Soyadı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Selim Karadağ"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası *
              </label>
              <input
                type="text"
                required
                placeholder="+90 532 123 45 67"
                value={newLeadPhone}
                onChange={(e) => setNewLeadPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                İlgilendiği Konut Tipi
              </label>
              <select
                value={housingType}
                onChange={(e) => setHousingType(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="1+1 Rezidans">1+1 Rezidans</option>
                <option value="2+1 Rezidans">2+1 Rezidans</option>
                <option value="3+1 Aile Dairesi">3+1 Aile Dairesi</option>
                <option value="Müstakil Villa">Müstakil Villa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Tahmini Bütçe (TL)
              </label>
              <input
                type="number"
                value={leadBudget}
                onChange={(e) => setLeadBudget(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          {/* Meta Reklamı Özel Form Soruları */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#4a443f]/40">
            <div>
              <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                Form Sorusu: Alım Amacı
              </label>
              <select
                value={investmentPurpose}
                onChange={(e) => setInvestmentPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Yatırım & Kira Getirisi">Yatırım & Kira Getirisi</option>
                <option value="Kendi Oturumum İçin">Kendi Oturumum İçin</option>
                <option value="Çocuklarım İçin Geleceğe Yatırım">Çocuklarım İçin Geleceğe Yatırım</option>
                <option value="Ticari / Ofis Kullanımı">Ticari / Ofis Kullanımı</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                Form Sorusu: Satın Alma Süresi
              </label>
              <select
                value={moveInTiming}
                onChange={(e) => setMoveInTiming(e.target.value)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Hemen (1-3 Ay İçinde)">Hemen (1-3 Ay İçinde)</option>
                <option value="3 - 6 Ay İçinde">3 - 6 Ay İçinde</option>
                <option value="6 - 12 Ay (Proje Teslimine Kadar)">6 - 12 Ay (Proje Teslimine Kadar)</option>
                <option value="Sadece Piyasa Araştırması">Sadece Piyasa Araştırması</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSimulateOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              İptal
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Webhook Gönder
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}

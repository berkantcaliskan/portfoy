import React, { useState } from 'react'
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
import { MetaFormSummary } from '@/types/meta'

export const MarketingCampaignsView: React.FC = () => {
  const [forms, setForms] = useState<MetaFormSummary[]>(metaStore.getForms())
  const [isSimulateOpen, setIsSimulateOpen] = useState(false)
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadPhone, setNewLeadPhone] = useState('')
  const [selectedFormName, setSelectedFormName] = useState(forms[0]?.name || '')
  const [leadBudget, setLeadBudget] = useState<number>(4500000)
  const [housingType, setHousingType] = useState('2+1 Rezidans')
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
    })

    setForms(metaStore.getForms())
    setIsSimulateOpen(false)
    setNewLeadName('')
    setNewLeadPhone('')
    setSuccessMsg('Canlı Meta Webhook başarıyla simüle edildi ve ortak müşteri havuzuna işlendi.')
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
            <h2 className="text-xl font-bold tracking-tight text-white">
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
          <div className="text-[11px] text-[#8c857f] mt-1">3 Aktif Meta Reklam Formu</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-emerald-400">Ortalama Dönüşüm</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">%{avgConversion}</div>
          <div className="text-[11px] text-[#8c857f] mt-1">Formdan randevuya dönüşüm</div>
        </GlassCard>

        <GlassCard className="p-4 bg-[#282522] border-[#4a443f]">
          <div className="text-xs text-sky-400">Entegrasyon Durumu</div>
          <div className="text-sm font-semibold text-white mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Meta Webhook Dinleniyor
          </div>
          <div className="text-[11px] text-[#8c857f] mt-1">SSL Şifreli Uç Nokta</div>
        </GlassCard>
      </div>

      {/* Kampanya ve Form Kartları */}
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

            <div className="pt-3 border-t border-[#4a443f] flex items-center justify-between text-xs">
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

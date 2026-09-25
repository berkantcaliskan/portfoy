import React, { useState } from 'react'
import {
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  Building,
  DollarSign,
  UserCheck,
  Send,
  Sparkles,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { Lead, LeadActivity, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { portfolioStore } from '@/services/portfolioStore'
import { leadStore } from '@/services/leadStore'
import {
  formatCurrency,
  formatDate,
  formatPhoneNumber,
  generateWhatsAppUrl,
} from '@/utils/formatters'

interface LeadDetailModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onStageChange: (leadId: string, stage: LeadStage) => void
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onStageChange,
}) => {
  if (!lead) return null

  const [newNote, setNewNote] = useState('')
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState('')
  const activities = leadStore.getActivities(lead.id)
  const matchingProperties = portfolioStore.matchPropertiesForLead(lead)

  const quickMsgTemplates = [
    {
      title: 'Tanışma & İlk İletişim',
      msg: `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy'den arıyorum. Konut ve yatırım projelerimiz hakkında bıraktığınız form ile ilgili detaylı bilgi vermek için iletişime geçtim. Ne zaman müsait olursunuz?`,
    },
    {
      title: 'Randevu & Sunum Daveti',
      msg: `Sayın ${lead.fullName}, Demirtürk Portföy projemizin örnek dairesini ve kat planlarını birlikte incelemek üzere sizi satış ofisimize kahveye davet etmek isteriz. Hangi gün size uygun olur?`,
    },
    {
      title: 'Teklif & Portföy Özeti',
      msg: `Sayın ${lead.fullName}, ilgilendiğiniz konut seçeneğine ait güncel fiyat listesi ve esnek ödeme planını ekte paylaşıyorum. Detayları inceledikten sonra değerlendirebiliriz.`,
    },
  ]

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return
    leadStore.addActivity(lead.id, 'NOTE', newNote.trim(), 'Danışman')
    setNewNote('')
  }

  const currentWaUrl = generateWhatsAppUrl(
    lead.phone,
    lead.fullName,
    customWhatsAppMsg || undefined
  )

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={lead.fullName}
      description={`Kayıt No: #${lead.id} • Eklenme: ${formatDate(lead.createdAt)}`}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top Key Contact & Stage Bar (Pill Shaped) */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 rounded-full bg-navy-950/60 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#b99881] text-slate-950 flex items-center justify-center font-bold text-sm shadow-sm">
              {lead.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {lead.fullName}
                {lead.preferredHousingType && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-gold/15 text-brand-goldLight border border-brand-gold/30">
                    {lead.preferredHousingType}
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-300 font-mono">
                {formatPhoneNumber(lead.phone)}
              </p>
            </div>
          </div>

          {/* Quick Stage Switcher */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">
              Aşama:
            </label>
            <select
              value={lead.stage}
              onChange={(e) => onStageChange(lead.id, e.target.value as LeadStage)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-navy-850 border border-brand-gold/40 text-brand-goldLight focus:outline-none focus:border-brand-gold cursor-pointer"
            >
              {Object.keys(STAGE_CONFIGS).map((key) => (
                <option key={key} value={key}>
                  {STAGE_CONFIGS[key as LeadStage].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Info Grid (Pill Curved Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400">Meta Reklam Formu</span>
            <p className="text-xs font-semibold text-amber-300 font-mono truncate" title={lead.formName}>
              {lead.formName}
            </p>
          </div>
          <div className="p-4 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400">Bütçe Beklentisi</span>
            <p className="text-sm font-bold text-emerald-400">
              {lead.budget ? formatCurrency(lead.budget) : 'Belirtilmedi'}
            </p>
          </div>
          <div className="p-4 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400">Atanan Temsilci</span>
            <p className="text-xs font-semibold text-slate-200">
              {lead.owner || 'Atanmadı'}
            </p>
          </div>
        </div>

        {/* WhatsApp Hızlı Mesajlaşma Merkezi (Pill Shaped) */}
        <div className="p-5 rounded-[28px] bg-emerald-950/20 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <h5 className="text-xs font-bold text-emerald-300 tracking-wide uppercase">
                Hızlı WhatsApp Mesajı Gönder
              </h5>
            </div>
            <a
              href={currentWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <span>WhatsApp'ta Aç</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Quick template chips */}
          <div className="flex flex-wrap gap-2">
            {quickMsgTemplates.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCustomWhatsAppMsg(t.msg)}
                className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-colors cursor-pointer"
              >
                + {t.title}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            value={customWhatsAppMsg}
            onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
            placeholder="Kişiselleştirilmiş WhatsApp mesajını buraya yazabilir veya yukarıdaki hazır şablonlardan birine tıklayabilirsiniz..."
            className="w-full bg-navy-950/70 border border-emerald-500/30 rounded-[20px] p-3 text-xs text-white placeholder-slate-400/60 focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* Demirtürk Portföy - Eşleşen Gayrimenkuller */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <h5 className="text-xs font-bold text-brand-goldLight uppercase tracking-wide">
              Bu Müşteriye Önerilen Portföy Seçenekleri ({matchingProperties.length})
            </h5>
          </div>

          {matchingProperties.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Müşterinin bütçesi veya konut tercihine göre şu anda eşleşen boş portföy bulunamadı.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {matchingProperties.map((prop) => {
                const propShareMsg = `Merhaba ${lead.fullName}, talebinize özel olarak Demirtürk Portföy'deki ${prop.title} (${prop.type}, ${prop.netM2} m², ${formatCurrency(prop.price)}) portföyümüzü sizinle paylaşmak isterim. Detayları incelemek ister misiniz?`
                const propWaUrl = generateWhatsAppUrl(lead.phone, lead.fullName, propShareMsg)

                return (
                  <div
                    key={prop.id}
                    className="flex gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 hover:border-brand-gold/30 transition-colors"
                  >
                    <img
                      src={prop.imageUrl}
                      alt={prop.title}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h6 className="text-xs font-bold text-white truncate">
                        {prop.title}
                      </h6>
                      <p className="text-[11px] text-slate-400 truncate">
                        {prop.location} • {prop.type} • {prop.netM2} m²
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-brand-gold">
                          {formatCurrency(prop.price)}
                        </span>
                        <a
                          href={propWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                        >
                          WhatsApp ile Paylaş
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Notes & Activity Timeline */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Görüşme Geçmişi & Notlar
          </h5>

          {/* Add note form */}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Yeni görüşme notu ekleyin (ör: Telefonla arandı, teklif iletildi vb.)..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-gold/60"
            />
            <GlassButton variant="gold" size="sm" type="submit" icon={<Plus className="w-3.5 h-3.5" />}>
              Ekle
            </GlassButton>
          </form>

          {/* Activities List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Henüz kaydedilmiş not veya geçmiş aktivite yok.
              </p>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200">
                      {act.content}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Ekleyen: <span className="text-slate-300">{act.author}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {formatDate(act.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </GlassModal>
  )
}

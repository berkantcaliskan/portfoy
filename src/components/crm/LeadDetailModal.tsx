import React, { useState } from 'react'
import {
  MessageCircle,
  Phone,
  Mail,
  Sparkles,
  ExternalLink,
  Plus,
  FileText,
  Copy,
  Check,
  Trash2,
  Clock,
  Globe,
} from 'lucide-react'
import { Lead, LeadStage } from '@/types/lead'
import { StageDropdown } from './StageDropdown'
import { GlassModal } from '@/components/ui/GlassModal'
import { portfolioStore } from '@/services/portfolioStore'
import { leadStore } from '@/services/leadStore'
import { userStore } from '@/services/userStore'
import {
  formatCurrency,
  formatDate,
  formatPhoneDisplay,
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
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const currentUser = userStore.getCurrentUser()
  const canDeleteLead =
    currentUser?.department === 'Pazarlama' ||
    currentUser?.departments?.includes('Pazarlama') ||
    currentUser?.role === 'ADMIN'

  const activities = leadStore.getActivities(lead.id)
  const matchingProperties = portfolioStore.matchPropertiesForLead(lead)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const formAnswers = (lead.metaAnswers && lead.metaAnswers.length > 0)
    ? lead.metaAnswers
    : (lead.inquiries && lead.inquiries[0]?.metaAnswers && lead.inquiries[0].metaAnswers.length > 0)
      ? lead.inquiries[0].metaAnswers
      : [
          ...(lead.preferredHousingType ? [{ question: 'İlgilendiğiniz Konut Tipi', answer: lead.preferredHousingType }] : []),
          ...(lead.budget ? [{ question: 'Bütçe Beklentisi', answer: formatCurrency(lead.budget) }] : []),
          ...(lead.notes ? [{ question: 'Form Notu / Talep', answer: lead.notes }] : []),
        ]

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
    leadStore.addActivity(lead.id, 'NOTE', newNote.trim(), currentUser?.fullName || 'Danışman')
    setNewNote('')
  }

  const currentWaUrl = generateWhatsAppUrl(
    lead.phone,
    lead.fullName,
    customWhatsAppMsg || undefined
  )

  const isWebLead =
    lead.source === 'WEBSITE' ||
    lead.channel?.toLowerCase().includes('web') ||
    lead.tags?.some((t) => t.toLowerCase().includes('web'))

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={lead.fullName}
      description={`Kayıt No: #${lead.id} • Eklenme: ${formatDate(lead.createdAt)}`}
      maxWidth="5xl"
    >
      <div className="space-y-3.5">
        {/* Üst Bilgi Şeridi: Kimlik, Bütçe, Temsilci, Aşama */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-[22px] bg-[#1e1c1a] border border-[#4a443f]">
          {/* Sol: Avatar & İletişim */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#b99881] text-[#1c1a18] flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
              {lead.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{lead.fullName}</span>
                {lead.preferredHousingType && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#b99881]/20 text-[#dfb76c] border border-[#b99881]/30">
                    {lead.preferredHousingType}
                  </span>
                )}
                {isWebLead ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    Web Sitesi
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    Meta Ads
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#d6beae] font-mono select-all">
                  {formatPhoneDisplay(lead.phone)}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(lead.phone, 'phone')}
                  className="text-[#8c857f] hover:text-white transition-colors p-0.5 rounded-md hover:bg-white/5 cursor-pointer"
                  title="Numarayı Kopyala"
                >
                  {copiedText === 'phone' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                {lead.email && (
                  <>
                    <span className="text-[#4a443f]">•</span>
                    <span className="text-[11px] text-[#a69f99] truncate max-w-[140px] font-mono">
                      {lead.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Orta ve Sağ: Bütçe, Temsilci & Aşama Değiştirici */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1 rounded-[16px] bg-[#282522] border border-[#3b3632] flex items-center gap-1.5">
              <span className="text-[10.5px] text-[#8c857f]">Bütçe:</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {lead.budget ? formatCurrency(lead.budget) : 'Belirtilmedi'}
              </span>
            </div>

            <div className="px-3 py-1 rounded-[16px] bg-[#282522] border border-[#3b3632] flex items-center gap-1.5">
              <span className="text-[10.5px] text-[#8c857f]">Temsilci:</span>
              <span className="text-xs font-semibold text-[#f3efe9]">
                {lead.assignedToUserName || lead.owner || 'Atanmadı'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-xs font-semibold text-[#a69f99]">Aşama:</span>
              <StageDropdown
                value={lead.stage}
                onChange={(newStage) => onStageChange(lead.id, newStage)}
              />
            </div>
          </div>
        </div>

        {/* 2 Kolonlu Ana Gövde (Sol: Talep & Form Cevapları, Sağ: Aksiyon & İletişim) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* SOL KOLON (lg:col-span-7): Form Bilgileri & Başvuru Detayları */}
          <div className="lg:col-span-7 space-y-3">
            {/* Form Yanıtları Kartı */}
            <div className="p-3.5 rounded-[22px] bg-[#201d1b] border border-[#4a443f] space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#3b3632]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#b99881]/20 border border-[#b99881]/30 flex items-center justify-center text-[#dfb76c]">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      Form Bilgileri & Yanıtlar
                    </h5>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-[#181614] text-[#dfb76c] border border-[#4a443f] font-semibold truncate max-w-[200px]" title={lead.formName}>
                    {lead.formName || 'İletişim Formu'}
                  </span>
                  {lead.inquiries && lead.inquiries.length > 1 && (
                    <span className="text-[10px] text-[#b99881] font-bold bg-[#b99881]/10 px-2 py-0.5 rounded-full border border-[#b99881]/25">
                      {lead.inquiries.length} Başvuru
                    </span>
                  )}
                </div>
              </div>

              {/* Soru & Cevap Listesi (2'li Kompakt Izgara) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formAnswers.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-[16px] bg-[#181614] border border-[#34302d] flex flex-col justify-between gap-1 hover:border-[#b99881]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-[#8c857f] uppercase tracking-wide truncate" title={item.question}>
                        {item.question}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.answer, `ans-${idx}`)}
                        className="text-[#8c857f] hover:text-white transition-colors p-0.5 rounded-md hover:bg-white/5 cursor-pointer shrink-0"
                        title="Cevabı Kopyala"
                      >
                        {copiedText === `ans-${idx}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-amber-100/90 break-words">
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Önerilen Portföy Seçenekleri */}
            {matchingProperties.length > 0 && (
              <div className="p-3 rounded-[20px] bg-[#201d1b] border border-[#4a443f] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#dfb76c] uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Önerilen Portföy Seçenekleri ({matchingProperties.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchingProperties.slice(0, 2).map((prop) => {
                    const propShareMsg = `Merhaba ${lead.fullName}, talebinize özel olarak Demirtürk Portföy'deki ${prop.title} (${prop.type}, ${prop.netM2} m², ${formatCurrency(prop.price)}) portföyümüzü sizinle paylaşmak isterim. Detayları incelemek ister misiniz?`
                    const propWaUrl = generateWhatsAppUrl(lead.phone, lead.fullName, propShareMsg)

                    return (
                      <div
                        key={prop.id}
                        className="flex gap-2.5 p-2 rounded-[14px] bg-[#181614] border border-[#34302d] hover:border-[#b99881]/40 transition-colors"
                      >
                        <img
                          src={prop.imageUrl}
                          alt={prop.title}
                          className="w-11 h-11 rounded-[10px] object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h6 className="text-[11px] font-bold text-white truncate">
                            {prop.title}
                          </h6>
                          <p className="text-[10px] text-[#8c857f] truncate">
                            {prop.location} • {prop.type}
                          </p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[11px] font-bold text-[#dfb76c]">
                              {formatCurrency(prop.price)}
                            </span>
                            <a
                              href={propWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9.5px] font-semibold text-emerald-400 hover:text-emerald-300 underline"
                            >
                              WhatsApp ile Paylaş
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SAĞ KOLON (lg:col-span-5): İletişim Aksiyonları & Görüşme Notları */}
          <div className="lg:col-span-5 space-y-3">
            {/* WhatsApp Hızlı Mesajlaşma Merkezi */}
            <div className="p-3.5 rounded-[22px] bg-emerald-950/20 border border-emerald-500/25 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Hızlı WhatsApp Mesajı</span>
                </div>
                <a
                  href={currentWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#141210] font-extrabold text-[11px] transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <span>WhatsApp'ta Aç</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Hazır Mesaj Şablonları */}
              <div className="flex flex-wrap gap-1.5">
                {quickMsgTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCustomWhatsAppMsg(t.msg)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-colors cursor-pointer"
                  >
                    + {t.title}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={customWhatsAppMsg}
                onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                placeholder="Özel WhatsApp mesajınızı buraya yazın veya yukarıdaki şablonlardan seçin..."
                className="w-full bg-[#161412] border border-emerald-500/30 rounded-[14px] p-2.5 text-xs text-[#e8dfd8] placeholder-[#7d7771] focus:outline-none focus:border-emerald-400 resize-none transition-colors shadow-inner"
              />
            </div>

            {/* Görüşme Notları & Takip Geçmişi */}
            <div className="p-3.5 rounded-[22px] bg-[#201d1b] border border-[#4a443f] space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Görüşme Notları & Takip</span>
                </div>
                <span className="text-[10px] text-[#8c857f] font-mono">
                  {activities.length} Aktivite
                </span>
              </div>

              {/* Not Ekleme Formu */}
              <form onSubmit={handleAddNote} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Görüşme notu ekleyin..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 bg-[#181614] border border-[#3b3632] rounded-[14px] px-3 py-1.5 text-xs text-white placeholder-[#7d7771] focus:outline-none focus:border-[#b99881]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[14px] bg-[#b99881] hover:bg-[#c9a790] text-[#1c1a18] text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Ekle
                </button>
              </form>

              {/* Aktivite Listesi */}
              <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
                {activities.length === 0 ? (
                  <p className="text-[10.5px] text-[#8c857f] italic py-2 text-center">
                    Henüz görüşme notu bulunmuyor.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded-[12px] bg-[#181614] border border-[#34302d] flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-[#f3efe9] text-[11px] break-words">
                          {act.content}
                        </div>
                        <div className="text-[9.5px] text-[#8c857f]">
                          Ekleyen: <span className="text-[#b99881]">{act.author}</span>
                        </div>
                      </div>
                      <span className="text-[9.5px] text-[#7d7771] shrink-0 font-mono">
                        {formatDate(act.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pazarlama Yetkilisi İçin Silme Aksiyonu (Kompakt) */}
            {canDeleteLead && (
              <div className="pt-0.5">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="w-full py-1.5 px-3 rounded-[14px] text-[11px] font-semibold text-rose-400/90 hover:text-white bg-rose-500/5 hover:bg-rose-600/80 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Müşteri Kaydını Sil (Pazarlama)</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-[16px] bg-rose-950/30 border border-rose-500/40 space-y-1.5">
                    <p className="text-[10.5px] text-rose-200">
                      Bu kayıt ve tüm verileri silinecek. Emin misiniz?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(false)}
                        className="px-2.5 py-1 rounded-full text-[10.5px] text-[#c7beba] hover:text-white bg-[#282522] border border-[#4a443f]"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          leadStore.delete(lead.id)
                          setIsConfirmingDelete(false)
                          onClose()
                        }}
                        className="px-3 py-1 rounded-full text-[10.5px] font-bold text-white bg-rose-600 hover:bg-rose-500"
                      >
                        Evet, Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassModal>
  )
}

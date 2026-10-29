import React, { useState, useEffect } from 'react'
import {
  MessageCircle,
  Mail,
  Sparkles,
  ExternalLink,
  FileText,
  Copy,
  Check,
  Trash2,
  Clock,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  Calendar,
  Award,
  Edit3,
  Phone,
} from 'lucide-react'
import { Lead, LeadStage } from '@/types/lead'
import { MetaCapiEventName } from '@/types/meta'
import { StageDropdown } from './StageDropdown'
import { CallStatusDropdown } from './CallStatusDropdown'
import { HOUSING_TYPES } from './LeadAddModal'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassButton } from '@/components/ui/GlassButton'
import { PhoneInput } from '@/components/common/PhoneInput'
import { portfolioStore } from '@/services/portfolioStore'
import { leadStore } from '@/services/leadStore'
import { userStore } from '@/services/userStore'
import { permissionService } from '@/services/permissionService'
import {
  formatCurrency,
  formatDate,
  formatPhoneDisplay,
  generateWhatsAppUrl,
  formatSentenceNote,
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
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [sendingCapi, setSendingCapi] = useState<MetaCapiEventName | null>(null)
  const [capiToast, setCapiToast] = useState<{ status: 'SENT' | 'QUEUED' | 'FAILED'; text: string } | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    const unsub = leadStore.subscribe(() => setTick((t) => t + 1))
    return unsub
  }, [])

  const liveLead = leadStore.getById(lead.id) || lead
  const allUsers = userStore.getAllUsers()
  const customerRelationsUsers = allUsers.filter(
    (u) =>
      (u.department === 'Müşteri İlişkileri' ||
        u.departments?.includes('Müşteri İlişkileri')) &&
      u.role !== 'ADMIN'
  )

  const [editForm, setEditForm] = useState({
    fullName: liveLead.fullName || '',
    phone: liveLead.phone || '',
    secondaryPhone: liveLead.secondaryPhone || '',
    email: liveLead.email || '',
    budget: liveLead.budget ? String(liveLead.budget) : '',
    preferredHousingType: liveLead.preferredHousingType || '2+1 Konut',
    assignedUserId: liveLead.assignedToUserId || '',
  })

  useEffect(() => {
    setEditForm({
      fullName: liveLead.fullName || '',
      phone: liveLead.phone || '',
      secondaryPhone: liveLead.secondaryPhone || '',
      email: liveLead.email || '',
      budget: liveLead.budget ? String(liveLead.budget) : '',
      preferredHousingType: liveLead.preferredHousingType || '2+1 Konut',
      assignedUserId: liveLead.assignedToUserId || '',
    })
  }, [liveLead.id, isEditingCustomer])

  const handleSaveCustomerEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm.fullName.trim() || !editForm.phone.trim()) return

    const assignedUser = allUsers.find((u) => u.id === editForm.assignedUserId)
    leadStore.update(
      liveLead.id,
      {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        whatsappPhone: editForm.phone.trim(),
        secondaryPhone: editForm.secondaryPhone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        budget: editForm.budget ? Number(editForm.budget) : undefined,
        preferredHousingType: editForm.preferredHousingType,
        assignedToUserId: assignedUser ? assignedUser.id : undefined,
        assignedToUserName: assignedUser ? assignedUser.fullName : undefined,
        owner: assignedUser ? assignedUser.fullName : 'Atanmamış',
      },
      currentUser
    )
    setIsEditingCustomer(false)
  }

  const currentUser = userStore.getCurrentUser()
  const canDeleteLead = permissionService.canDeleteCustomer(currentUser)

  const handleSendCapiSignal = async (signal: MetaCapiEventName) => {
    setSendingCapi(signal)
    setCapiToast(null)
    try {
      const log = await leadStore.sendLeadSignalToMeta(liveLead.id, signal, currentUser)
      if (log) {
        if (log.status === 'SENT') {
          setCapiToast({
            status: 'SENT',
            text: `Meta'ya başarıyla iletildi: ${log.signalLabel} (${log.eventName})`,
          })
        } else if (log.status === 'QUEUED') {
          setCapiToast({
            status: 'QUEUED',
            text: `${log.signalLabel} sinyali kaydedildi ve CAPI kuyruğuna alındı (Ayarlar > Meta & Reklam'dan Dataset ID girildiğinde otomatik iletilir).`,
          })
        } else {
          setCapiToast({
            status: 'FAILED',
            text: log.errorMessage || 'Meta CAPI gönderim hatası.',
          })
        }
        setTimeout(() => setCapiToast(null), 5000)
      }
    } finally {
      setSendingCapi(null)
    }
  }

  const activities = leadStore.getActivities(lead.id)
  const matchingProperties = portfolioStore.matchPropertiesForLead(lead)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const formAnswers = (liveLead.metaAnswers && liveLead.metaAnswers.length > 0)
    ? liveLead.metaAnswers
    : (liveLead.inquiries && liveLead.inquiries[0]?.metaAnswers && liveLead.inquiries[0].metaAnswers.length > 0)
      ? liveLead.inquiries[0].metaAnswers
      : [
          ...(liveLead.preferredHousingType ? [{ question: 'İlgilendiğiniz konut tipi', answer: liveLead.preferredHousingType }] : []),
          ...(liveLead.budget ? [{ question: 'Bütçe beklentisi', answer: formatCurrency(liveLead.budget) }] : []),
          ...(liveLead.secondaryPhone ? [{ question: 'İkincil telefon', answer: formatPhoneDisplay(liveLead.secondaryPhone) }] : []),
          ...(liveLead.email ? [{ question: 'E-posta adresi', answer: liveLead.email }] : []),
          ...(liveLead.notes ? [{ question: 'Form notu / talep', answer: liveLead.notes }] : []),
        ]

  const quickMsgTemplates = [
    {
      title: 'Tanışma ve ilk iletişim',
      msg: `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy'den arıyorum. Konut ve yatırım projelerimiz hakkında bıraktığınız form ile ilgili detaylı bilgi vermek için iletişime geçtim. Ne zaman müsait olursunuz?`,
    },
    {
      title: 'Randevu ve sunum daveti',
      msg: `Sayın ${lead.fullName}, Demirtürk Portföy projemizin örnek dairesini ve kat planlarını birlikte incelemek üzere sizi satış ofisimize kahveye davet etmek isteriz. Hangi gün size uygun olur?`,
    },
    {
      title: 'Teklif ve portföy özeti',
      msg: `Sayın ${lead.fullName}, ilgilendiğiniz konut seçeneğine ait güncel fiyat listesi ve esnek ödeme planını ekte paylaşıyorum. Detayları inceledikten sonra değerlendirebiliriz.`,
    },
  ]

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return
    const formatted = formatSentenceNote(newNote)
    leadStore.addActivity(lead.id, 'NOTE', formatted, currentUser?.fullName || 'Danışman')
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
      title={liveLead.fullName}
      description={`Kayıt No: ${leadStore.getLeadDisplayCode(liveLead)} • Eklenme: ${formatDate(liveLead.createdAt)}`}
      maxWidth="5xl"
    >
      <div className="space-y-3.5">
        {/* Üst Bilgi Şeridi: Şeffaf, yalnızca konturlu */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-[22px] bg-transparent border border-[#4a443f]">
          {/* Sol: Avatar & İletişim */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#b99881] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
              {liveLead.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white select-text">{liveLead.fullName}</span>
                {liveLead.preferredHousingType && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-transparent text-[#b99881] border border-[#b99881]/45">
                    {liveLead.preferredHousingType}
                  </span>
                )}
                {isWebLead ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/12 text-amber-700 border border-amber-500/40 flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-amber-600" />
                    Web sitesi
                  </span>
                ) : liveLead.source === 'DIRECT' ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/12 text-emerald-700 border border-emerald-500/40">
                    Manuel kayıt
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/12 text-blue-700 border border-blue-500/40">
                    Meta Ads
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-xs text-[#f3efe9] font-mono select-all">
                  {formatPhoneDisplay(liveLead.phone)}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(liveLead.phone, 'phone')}
                  className="text-[#8c857f] hover:text-white transition-colors p-0.5 rounded-md hover:bg-black/5 cursor-pointer"
                  title="Numarayı Kopyala"
                >
                  {copiedText === 'phone' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                {liveLead.secondaryPhone && (
                  <>
                    <span className="text-[#8c857f]">•</span>
                    <span className="text-[11px] text-[#a69f99] font-mono select-all flex items-center gap-1" title="İkincil Telefon">
                      <Phone className="w-3 h-3 shrink-0" />
                      {formatPhoneDisplay(liveLead.secondaryPhone)}
                    </span>
                  </>
                )}
                {liveLead.email && (
                  <>
                    <span className="text-[#8c857f]">•</span>
                    <span className="text-[11px] text-[#a69f99] truncate max-w-[160px] font-mono select-all flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" />
                      {liveLead.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Orta ve Sağ: Temsilci, Bilgileri Düzenle, Bilgi (Call Center) & Aşama (Meta) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3.5 py-1 rounded-full bg-transparent border border-[#4a443f] flex items-center gap-1.5">
              <span className="text-[10.5px] text-[#8c857f]">Danışman:</span>
              <span className="text-xs font-semibold text-[#f3efe9]">
                {liveLead.assignedToUserName || (liveLead.owner && liveLead.owner !== 'Atanmamış' ? liveLead.owner : 'Atanmadı')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingCustomer((prev) => !prev)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                isEditingCustomer
                  ? 'bg-[#b99881] text-white border-[#b99881]'
                  : 'bg-[#34302d] hover:bg-[#3d3733] text-[#d6beae] hover:text-white border-[#4a443f]'
              }`}
              title="Müşteri bilgilerini düzenle (ikincil telefon, e-posta vb.)"
            >
              <Edit3 className="w-3 h-3" />
              <span>Müşteri bilgilerini düzenle</span>
            </button>

            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-xs font-semibold text-[#a69f99]">Bilgi:</span>
              <CallStatusDropdown
                value={liveLead.callStatus || 'WAITING'}
                onChange={(newCallStatus) => leadStore.updateCallStatus(liveLead.id, newCallStatus, currentUser)}
              />
            </div>

            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-xs font-semibold text-[#a69f99]">Aşama:</span>
              <StageDropdown
                value={liveLead.stage}
                onChange={(newStage) => onStageChange(liveLead.id, newStage)}
              />
            </div>
          </div>
        </div>

        {/* MÜŞTERİ BİLGİLERİNİ DÜZENLE PANELİ (Bütçe Beklentisi, İkincil Telefon, E-posta vb.) */}
        {isEditingCustomer && (
          <form
            onSubmit={handleSaveCustomerEdit}
            className="p-4 rounded-[22px] bg-transparent border border-[#b99881]/50 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#b99881]" />
                <span>Müşteri bilgilerini düzenle</span>
              </h5>
              <span className="text-[11px] text-[#8c857f]">
                Bütçe beklentisi, ikincil telefon, e-posta ve danışman bilgilerini güncelleyin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <GlassInput
                label="Adı ve soyadı *"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                placeholder="Örn: Mehmet Demir"
              />

              <PhoneInput
                label="Telefon numarası *"
                value={editForm.phone}
                onChange={(val) => setEditForm({ ...editForm, phone: val })}
                required
              />

              <GlassInput
                label="İkincil telefon (isteğe bağlı)"
                type="tel"
                placeholder="Örn: 0532 000 00 00"
                value={editForm.secondaryPhone}
                onChange={(e) => setEditForm({ ...editForm, secondaryPhone: e.target.value })}
              />

              <GlassInput
                label="E-posta adresi (isteğe bağlı)"
                type="email"
                placeholder="Örn: mehmet@gmail.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />

              <GlassInput
                label="Bütçe beklentisi (₺)"
                type="number"
                placeholder="Örn: 5000000"
                value={editForm.budget}
                onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#f3efe9]">
                  Konut tipi tercihi
                </label>
                <select
                  value={editForm.preferredHousingType}
                  onChange={(e) => setEditForm({ ...editForm, preferredHousingType: e.target.value })}
                  className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
                >
                  {HOUSING_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-[#24211f] text-white">
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#f3efe9]">
                  Danışman ata
                </label>
                <select
                  value={editForm.assignedUserId}
                  onChange={(e) => setEditForm({ ...editForm, assignedUserId: e.target.value })}
                  className="w-full rounded-full bg-[#24211f] border border-[#4a443f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
                >
                  <option value="" className="bg-[#24211f] text-white">
                    Danışman ataması yapma
                  </option>
                  {customerRelationsUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#24211f] text-white">
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <GlassButton
                variant="subtle"
                size="sm"
                type="button"
                onClick={() => setIsEditingCustomer(false)}
              >
                Vazgeç
              </GlassButton>
              <GlassButton variant="gold" size="sm" type="submit" className="px-5 font-bold">
                Değişiklikleri kaydet
              </GlassButton>
            </div>
          </form>
        )}

        {/* Meta Dönüşümler API'si (CAPI) Sinyal ve Kalite Bildirim Çubuğu */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 rounded-[20px] bg-transparent border border-[#4a443f]">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-[11px] font-bold text-white">Meta Dönüşümler API (CAPI):</span>
            {liveLead.metaCapiStatus ? (
              <span
                className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-semibold border ${
                  liveLead.metaCapiStatus.status === 'SENT'
                    ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/35'
                    : liveLead.metaCapiStatus.status === 'QUEUED'
                    ? 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                    : 'bg-rose-500/12 text-rose-400 border-rose-500/35'
                }`}
                title={liveLead.metaCapiStatus.errorMessage || `Olay: ${liveLead.metaCapiStatus.lastEventName}`}
              >
                {liveLead.metaCapiStatus.status === 'SENT'
                  ? `İletildi: ${liveLead.metaCapiStatus.label}`
                  : liveLead.metaCapiStatus.status === 'QUEUED'
                  ? `Kuyrukta: ${liveLead.metaCapiStatus.label}`
                  : `Hata: ${liveLead.metaCapiStatus.label}`}
              </span>
            ) : (
              <span className="text-[10.5px] text-[#8c857f]">
                Aşama değiştiğinde otomatik veya sağdaki butonlarla anında Meta'ya bildirilir
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={sendingCapi !== null}
              onClick={() => handleSendCapiSignal('QualifiedLead')}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-teal-500/12 hover:bg-teal-500/25 text-teal-300 border border-teal-500/35 transition-colors cursor-pointer flex items-center gap-1"
              title="Meta'ya Nitelikli (QualifiedLead) sinyali gönder"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{sendingCapi === 'QualifiedLead' ? 'Gönderiliyor...' : 'Nitelikli'}</span>
            </button>

            <button
              type="button"
              disabled={sendingCapi !== null}
              onClick={() => handleSendCapiSignal('Schedule')}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-indigo-500/12 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/35 transition-colors cursor-pointer flex items-center gap-1"
              title="Meta'ya Teklif (Schedule) sinyali gönder"
            >
              <Calendar className="w-3 h-3" />
              <span>{sendingCapi === 'Schedule' ? 'Gönderiliyor...' : 'Teklif'}</span>
            </button>

            <button
              type="button"
              disabled={sendingCapi !== null}
              onClick={() => handleSendCapiSignal('Purchase')}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-500/12 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors cursor-pointer flex items-center gap-1"
              title="Meta'ya Dönüşüm (Purchase) sinyali gönder"
            >
              <Award className="w-3 h-3" />
              <span>{sendingCapi === 'Purchase' ? 'Gönderiliyor...' : 'Dönüşüm'}</span>
            </button>

            <button
              type="button"
              disabled={sendingCapi !== null}
              onClick={() => handleSendCapiSignal('DisqualifiedLead')}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-rose-500/12 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 transition-colors cursor-pointer flex items-center gap-1"
              title="Meta'ya Potansiyel Değil (DisqualifiedLead) sinyali gönder"
            >
              <XCircle className="w-3 h-3" />
              <span>{sendingCapi === 'DisqualifiedLead' ? 'Gönderiliyor...' : 'Potansiyel değil'}</span>
            </button>
          </div>
        </div>

        {capiToast && (
          <div
            className={`px-3.5 py-2 rounded-[14px] border text-xs flex items-center gap-2 ${
              capiToast.status === 'SENT'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : capiToast.status === 'QUEUED'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>{capiToast.text}</span>
          </div>
        )}

        {/* 2 Kolonlu Ana Gövde (Sol: Talep & Form Cevapları, Sağ: Aksiyon & İletişim) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* SOL KOLON (lg:col-span-7): Form Bilgileri & Başvuru Detayları */}
          <div className="lg:col-span-7 space-y-3">
            {/* Form Yanıtları Kartı: Şeffaf, yalnızca konturlu */}
            <div className="p-3.5 rounded-[22px] bg-transparent border border-[#4a443f] space-y-2.5">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#b99881]" />
                  <div>
                    <h5 className="text-xs font-bold text-white tracking-wide">
                      Form bilgileri ve yanıtlar
                    </h5>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-transparent text-[#f3efe9] border border-[#4a443f] font-semibold truncate max-w-[200px]"
                    title={lead.formName}
                  >
                    {lead.formName || 'İletişim formu'}
                  </span>
                  {lead.inquiries && lead.inquiries.length > 1 && (
                    <span className="text-[10px] text-[#b99881] font-bold bg-transparent px-2 py-0.5 rounded-full border border-[#b99881]/40">
                      {lead.inquiries.length} Başvuru
                    </span>
                  )}
                </div>
              </div>

              {/* Soru & Cevap Listesi (2'li Kompakt Izgara - Şeffaf, Yalnızca Konturlu) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formAnswers.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-[16px] bg-transparent border border-[#4a443f] flex flex-col justify-between gap-1 hover:border-[#b99881]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="text-[10px] font-bold text-[#8c857f] tracking-wide truncate"
                        title={item.question}
                      >
                        {item.question}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.answer, `ans-${idx}`)}
                        className="text-[#8c857f] hover:text-white transition-colors p-0.5 rounded-full hover:bg-black/5 cursor-pointer shrink-0"
                        title="Cevabı Kopyala"
                      >
                        {copiedText === `ans-${idx}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-[#f3efe9] break-words select-text">
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Önerilen Portföy Seçenekleri: Şeffaf, yalnızca konturlu */}
            {matchingProperties.length > 0 && (
              <div className="p-3 rounded-[20px] bg-transparent border border-[#4a443f] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#f3efe9] tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Önerilen portföy seçenekleri ({matchingProperties.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchingProperties.slice(0, 2).map((prop) => {
                    const propShareMsg = `Merhaba ${lead.fullName}, talebinize özel olarak Demirtürk Portföy'deki ${prop.title} (${prop.type}, ${prop.netM2} m², ${formatCurrency(prop.price)}) portföyümüzü sizinle paylaşmak isterim. Detayları incelemek ister misiniz?`
                    const propWaUrl = generateWhatsAppUrl(lead.phone, lead.fullName, propShareMsg)

                    return (
                      <div
                        key={prop.id}
                        className="flex gap-2.5 p-2 rounded-[14px] bg-transparent border border-[#4a443f] hover:border-[#b99881]/50 transition-colors"
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
                            <span className="text-[11px] font-bold text-[#b99881]">
                              {formatCurrency(prop.price)}
                            </span>
                            <a
                              href={propWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9.5px] font-semibold text-emerald-700 hover:text-emerald-800 underline"
                            >
                              WhatsApp ile paylaş
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
            {/* WhatsApp Hızlı Mesajlaşma Merkezi: Şeffaf, yalnızca konturlu */}
            <div className="p-3.5 rounded-[22px] bg-transparent border border-[#4a443f] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 tracking-wide">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hızlı WhatsApp mesajı</span>
                </div>
                <a
                  href={currentWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whatsapp-action-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer"
                >
                  <span>WhatsApp'ta aç</span>
                  <ExternalLink className="w-3 h-3 text-white" />
                </a>
              </div>

              {/* Hazır Mesaj Şablonları: Şeffaf, yalnızca konturlu, okunaklı koyu yeşil yazı */}
              <div className="flex flex-wrap gap-1.5">
                {quickMsgTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCustomWhatsAppMsg(t.msg)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-transparent hover:bg-emerald-500/10 text-emerald-800 border border-emerald-600/35 transition-colors cursor-pointer"
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
                className="w-full bg-transparent border border-[#4a443f] rounded-[14px] p-2.5 text-xs text-[#f3efe9] placeholder-[#8c857f] focus:outline-none focus:border-emerald-600 resize-none transition-colors"
              />
            </div>

            {/* Görüşme Notları & Takip Geçmişi: Şeffaf, yalnızca konturlu */}
            <div className="p-3.5 rounded-[22px] bg-transparent border border-[#4a443f] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Görüşme notları ve takip</span>
                </div>
                <span className="text-[10px] text-[#8c857f] font-mono">
                  {activities.length} aktivite
                </span>
              </div>

              {/* Not Ekleme Formu */}
              <form onSubmit={handleAddNote} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Görüşme notu ekleyin..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 bg-transparent border border-[#4a443f] rounded-full px-3.5 py-1.5 text-xs text-[#f3efe9] placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-[#b99881] hover:bg-[#c9a790] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Ekle
                </button>
              </form>

              {/* Aktivite Listesi: Şeffaf, yalnızca konturlu */}
              <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
                {activities.length === 0 ? (
                  <p className="text-[10.5px] text-[#8c857f] italic py-2 text-center">
                    Henüz görüşme notu bulunmuyor.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded-[12px] bg-transparent border border-[#4a443f] flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-[#f3efe9] text-[11px] break-words select-text">
                          {act.content}
                        </div>
                        <div className="text-[9.5px] text-[#8c857f]">
                          Ekleyen: <span className="font-semibold text-[#b99881]">{act.author}</span>
                        </div>
                      </div>
                      <span className="text-[9.5px] text-[#8c857f] shrink-0 tabular-nums">
                        {formatDate(act.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pazarlama Yetkilisi İçin Silme Aksiyonu (Şeffaf, yalnızca konturlu) */}
            {canDeleteLead && (
              <div className="pt-0.5">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="delete-lead-btn w-full py-1.5 px-3 rounded-full text-[11px] font-bold text-red-600 hover:text-white bg-red-500/12 hover:bg-red-600 border border-red-500/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Müşteri kaydını sil</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-[16px] bg-transparent border border-rose-500/45 space-y-1.5">
                    <p className="text-[10.5px] font-medium text-rose-700">
                      Bu kayıt ve tüm verileri silinecek. Emin misiniz?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(false)}
                        className="px-2.5 py-1 rounded-full text-[10.5px] text-[#f3efe9] bg-transparent border border-[#4a443f] cursor-pointer"
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
                        className="px-3 py-1 rounded-full text-[10.5px] font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
                      >
                        Evet, sil
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

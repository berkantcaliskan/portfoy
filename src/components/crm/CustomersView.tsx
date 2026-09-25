import React, { useState } from 'react'
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserPlus,
  Sparkles,
  Phone,
  MessageSquare,
  History,
  Layers,
  Calendar,
  Building,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { Lead, STAGE_CONFIGS } from '@/types/lead'
import { leadStore } from '@/services/leadStore'
import { userStore, AppUser } from '@/services/userStore'
import { formatCurrency, formatDate, generateWhatsAppUrl } from '@/utils/formatters'

interface CustomersViewProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  currentUser?: AppUser | null
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  leads,
  onSelectLead,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string>('ALL')

  // Modals
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<Lead | null>(null)
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string>('')
  const [assignNote, setAssignNote] = useState('')

  const [selectedLeadForQualify, setSelectedLeadForQualify] = useState<Lead | null>(null)
  const [qualifyNote, setQualifyNote] = useState('')

  const [selectedInquiryHistoryLead, setSelectedInquiryHistoryLead] = useState<Lead | null>(null)

  const allUsers = userStore.getAllUsers()
  const salesUsers = allUsers.filter((u) => u.department === 'Satış')

  const filteredLeads = leads.filter((l) => {
    if (filterStage === 'UNCONTACTED' && l.stage !== 'NEW') return false
    if (filterStage === 'QUALIFIED' && l.stage !== 'QUALIFIED') return false
    if (filterStage === 'ASSIGNED' && !l.assignedToUserId) return false

    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.fullName.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.formName.toLowerCase().includes(q)
    )
  })

  const handleOpenAssign = (lead: Lead) => {
    setSelectedLeadForAssign(lead)
    setSelectedSalesUserId(salesUsers[0]?.id || '')
    setAssignNote('')
  }

  const handleExecuteAssign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAssign || !currentUser) return

    const targetUser = allUsers.find((u) => u.id === selectedSalesUserId)
    if (!targetUser) return

    leadStore.assignToSales(selectedLeadForAssign.id, targetUser, currentUser, assignNote)
    setSelectedLeadForAssign(null)
  }

  const handleOpenQualify = (lead: Lead) => {
    setSelectedLeadForQualify(lead)
    setQualifyNote('')
  }

  const handleExecuteQualify = (isQualified: boolean) => {
    if (!selectedLeadForQualify || !currentUser) return

    leadStore.qualifyLead(selectedLeadForQualify.id, currentUser, isQualified, qualifyNote)
    setSelectedLeadForQualify(null)
  }

  const handleVerifyAi = (lead: Lead) => {
    if (!currentUser || !lead.aiEvaluation) return
    leadStore.verifyAiEvaluation(lead.id, currentUser, true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Müşteriler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Kişi kimliği, başvuru geçmişleri, nitelik doğrulama ve satış temsilcisine atama havuzu.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[20px] bg-[#282522] border border-[#4a443f]">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'ALL', label: `Tümü (${leads.length})` },
            { id: 'UNCONTACTED', label: `İletişim Bekleyen (${leads.filter((l) => l.stage === 'NEW').length})` },
            { id: 'QUALIFIED', label: `Nitelikli (${leads.filter((l) => l.stage === 'QUALIFIED').length})` },
            { id: 'ASSIGNED', label: `Satışa Atanan (${leads.filter((l) => Boolean(l.assignedToUserId)).length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStage(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 ${
                filterStage === f.id
                  ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="İsim, telefon veya kampanya ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
          />
        </div>
      </div>

      {/* Müşteri Tablosu */}
      <GlassCard className="p-5 bg-[#282522] border-[#4a443f]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#4a443f] text-[#8c857f] text-[11px]">
                <th className="py-2.5 px-3">Müşteri</th>
                <th className="py-2.5 px-3">İletişim</th>
                <th className="py-2.5 px-3">Başvuru Sayısı</th>
                <th className="py-2.5 px-3">Aşama & Nitelik</th>
                <th className="py-2.5 px-3">YZ Önerisi</th>
                <th className="py-2.5 px-3">Atanan Danışman</th>
                <th className="py-2.5 px-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4a443f]/60 text-[#f3efe9]">
              {filteredLeads.map((lead) => {
                const inquiryCount = lead.inquiries?.length || 1
                const hasAi = Boolean(lead.aiEvaluation)

                return (
                  <tr key={lead.id} className="hover:bg-[#34302d] transition-colors">
                    <td className="py-3 px-3">
                      <div
                        onClick={() => onSelectLead(lead)}
                        className="font-bold text-white hover:text-[#b99881] cursor-pointer"
                      >
                        {lead.fullName}
                      </div>
                      <div className="text-[10px] text-[#8c857f]">{lead.preferredHousingType || 'Konut'}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span>{lead.phone}</span>
                        <a
                          href={generateWhatsAppUrl(lead.whatsappPhone || lead.phone, lead.fullName)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedInquiryHistoryLead(lead)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] text-[11px] cursor-pointer"
                        title="Tüm Başvuru Geçmişini Görüntüle"
                      >
                        <Layers className="w-3 h-3 text-[#b99881]" />
                        <span>{inquiryCount} Başvuru</span>
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <GlassBadge size="sm" variant={lead.stage === 'QUALIFIED' ? 'success' : lead.stage === 'NEW' ? 'warning' : 'primary'}>
                        {STAGE_CONFIGS[lead.stage]?.label || lead.stage}
                      </GlassBadge>
                    </td>

                    <td className="py-3 px-3">
                      {hasAi && lead.aiEvaluation ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#d6beae] font-medium" title={lead.aiEvaluation.rationale}>
                            {lead.aiEvaluation.suggestion}
                          </span>
                          {!lead.aiEvaluation.humanVerified ? (
                            <button
                              onClick={() => handleVerifyAi(lead)}
                              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/30 cursor-pointer"
                              title="Yapay zekâ önerisini insan gözüyle onayla"
                            >
                              Onayla
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-semibold" title="İnsan tarafından doğrulandı">
                              ✓ Doğrulandı
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#8c857f] text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {lead.assignedToUserName ? (
                        <span className="text-white font-medium text-xs">{lead.assignedToUserName}</span>
                      ) : (
                        <span className="text-amber-400/80 text-[11px]">Atama Bekliyor</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenQualify(lead)}
                          className="px-2.5 py-1 rounded-[8px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 text-xs font-semibold cursor-pointer"
                          title="Nitelik Değerlendirmesi Yap"
                        >
                          Nitelik
                        </button>
                        <button
                          onClick={() => handleOpenAssign(lead)}
                          className="px-2.5 py-1 rounded-[8px] bg-[#b99881]/20 hover:bg-[#b99881]/30 text-[#d6beae] border border-[#b99881]/30 text-xs font-semibold cursor-pointer"
                          title="Satış Temsilcisine Ata"
                        >
                          Satışa Ata
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* SATIŞA ATA MODALI */}
      <GlassModal
        isOpen={selectedLeadForAssign !== null}
        onClose={() => setSelectedLeadForAssign(null)}
        title={`Satış Danışmanına Ata - ${selectedLeadForAssign?.fullName}`}
      >
        <form onSubmit={handleExecuteAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Satış Temsilcisi Seçin *
            </label>
            <select
              value={selectedSalesUserId}
              onChange={(e) => setSelectedSalesUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            >
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Devir Notu (Müşteri İlişkileri Özeti)
            </label>
            <textarea
              rows={3}
              placeholder="Müşterinin ilgilendiği proje, bütçesi, randevu saati tercihi vb."
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedLeadForAssign(null)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Satış Ekibine Devret
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* NİTELİK DEĞERLENDİRME MODALI */}
      <GlassModal
        isOpen={selectedLeadForQualify !== null}
        onClose={() => setSelectedLeadForQualify(null)}
        title={`Müşteri Nitelik Değerlendirmesi - ${selectedLeadForQualify?.fullName}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Müşteri İlişkileri görüşmesi sonrasında adayın gerçek satın alma potansiyelini doğrulayın veya olumsuz olarak işaretleyin.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Görüşme & Nitelik Notu
            </label>
            <textarea
              rows={3}
              placeholder="Görüşme detayları, bütçe doğrulaması, kredi uygunluğu vb."
              value={qualifyNote}
              onChange={(e) => setQualifyNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => handleExecuteQualify(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 cursor-pointer"
            >
              Olumsuz Olarak İşaretle
            </button>
            <GlassButton
              type="button"
              variant="gold"
              size="sm"
              onClick={() => handleExecuteQualify(true)}
              className="rounded-full px-5 font-bold"
            >
              Nitelikli Olarak Onayla
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* BAŞVURU GEÇMİŞİ MODALI */}
      <GlassModal
        isOpen={selectedInquiryHistoryLead !== null}
        onClose={() => setSelectedInquiryHistoryLead(null)}
        title={`Başvuru & Kampanya Geçmişi - ${selectedInquiryHistoryLead?.fullName}`}
      >
        <div className="space-y-3">
          <p className="text-xs text-[#8c857f]">
            Müşterinin zaman içinde Meta Ads veya doğrudan formlar üzerinden yaptığı tüm başvurular tekil kişi kimliği altında saklanır:
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {selectedInquiryHistoryLead?.inquiries && selectedInquiryHistoryLead.inquiries.length > 0 ? (
              selectedInquiryHistoryLead.inquiries.map((inq, i) => (
                <div key={inq.id || i} className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{inq.formName}</span>
                    <span className="text-[10px] text-[#8c857f]">{new Date(inq.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="text-[11px] text-[#a69f99]">
                    Kanal: {inq.channel} • Tercih: {inq.preferredHousingType || 'Belirtilmedi'} • Bütçe: {inq.budget ? formatCurrency(inq.budget) : 'Belirtilmedi'}
                  </div>
                  {inq.notes && (
                    <div className="text-[10px] text-[#8c857f] italic">
                      "{inq.notes}"
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 rounded-[14px] bg-[#34302d] border border-[#4a443f] text-xs text-white">
                İlk başvuru: {selectedInquiryHistoryLead?.formName} ({formatDate(selectedInquiryHistoryLead?.createdAt || '')})
              </div>
            )}
          </div>
        </div>
      </GlassModal>
    </div>
  )
}

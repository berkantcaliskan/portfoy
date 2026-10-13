import React, { useState, useEffect } from 'react'
import {
  Filter,
  Grid,
  MessageCircle,
  Phone,
  Plus,
  Users,
  DownloadCloud,
  Check,
  RefreshCw,
} from 'lucide-react'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { StageDropdown } from '@/components/crm/StageDropdown'
import { leadStore } from '@/services/leadStore'
import { PortfolioItem, PropertyStatus } from '@/types/portfolio'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { LuxurySelect } from '@/components/ui/LuxurySelect'
import { DateRangePicker, DateRange } from '@/components/ui/DateRangePicker'
import { loadSavedDateRange, saveDateRange, checkDayRollover } from '@/services/dateFilterService'
import { formatCurrency, formatDate, formatPhoneNumber, generateWhatsAppUrl } from '@/utils/formatters'
import { PaginationBar } from '@/components/common/PaginationBar'

interface PortfolioViewProps {
  leads: Lead[]
  properties?: PortfolioItem[]
  onSelectLead: (lead: Lead) => void
  onStageChange: (leadId: string, stage: LeadStage) => void
  onOpenAddLead: () => void
  onPropertyStatusChange?: (id: string, status: PropertyStatus) => void
  onOpenAddProperty?: () => void
  searchQuery?: string
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  leads,
  onSelectLead,
  onStageChange,
  onOpenAddLead,
  searchQuery = '',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'leads-table' | 'leads-cards'>('leads-table')
  const [selectedStage, setSelectedStage] = useState<string>('ALL')
  const [selectedHousingType, setSelectedHousingType] = useState<string>('ALL')
  
  // Sayfalama (Pagination) Durumu - Varsayılan 20, Seçenekler 20, 50, 100
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  
  // Persistent date range filter (retains selection even across app closes, dynamically adapts presets to today)
  const [dateRange, setDateRangeState] = useState<DateRange>(() => loadSavedDateRange())

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range)
    saveDateRange(range)
  }

  // Check if midnight passed while app was running to adapt 'Bugün' dynamically to the new day
  useEffect(() => {
    const handleCheckRollover = () => {
      const rollover = checkDayRollover(dateRange)
      if (rollover) {
        setDateRangeState(rollover)
        saveDateRange(rollover)
      }
    }
    const interval = setInterval(handleCheckRollover, 30000)
    window.addEventListener('focus', handleCheckRollover)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleCheckRollover)
    }
  }, [dateRange])

  // Manuel Verileri Al (Artımlı / Incremental Sync) Durumu
  const [isPulling, setIsPulling] = useState(false)
  const [pullFeedback, setPullFeedback] = useState<{ message: string; isNew: boolean } | null>(null)

  const handlePullData = async () => {
    if (isPulling) return
    setIsPulling(true)
    try {
      const result = await leadStore.pullLatestLeads()
      if (result.error) {
        setPullFeedback({
          message: result.error,
          isNew: false,
        })
      } else if (result.newCount > 0) {
        setPullFeedback({
          message: `${result.newCount} yeni müşteri başarıyla alındı!`,
          isNew: true,
        })
      } else if (result.updatedCount > 0) {
        setPullFeedback({
          message: `${result.updatedCount} müşteri kaydı güncellendi.`,
          isNew: true,
        })
      } else {
        setPullFeedback({
          message: 'Tüm veriler güncel. Yeni veri bulunamadı.',
          isNew: false,
        })
      }
    } catch {
      setPullFeedback({
        message: 'Veri çekilirken bir hata oluştu.',
        isNew: false,
      })
    } finally {
      setIsPulling(false)
      setTimeout(() => {
        setPullFeedback(null)
      }, 4500)
    }
  }

  // Filter leads based on stage, housing type, search query, and date range
  const filteredLeads = leads.filter((lead) => {
    if (selectedStage !== 'ALL' && lead.stage !== selectedStage) return false
    if (selectedHousingType !== 'ALL' && lead.preferredHousingType !== selectedHousingType) return false
    if (
      searchQuery &&
      !lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !lead.phone.includes(searchQuery) &&
      !lead.formName?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }

    // Filter by Date Range
    if (dateRange.startDate) {
      const leadTime = new Date(lead.createdAt).getTime()
      if (!isNaN(leadTime)) {
        const start = new Date(dateRange.startDate)
        start.setHours(0, 0, 0, 0)
        if (leadTime < start.getTime()) return false

        if (dateRange.endDate) {
          const end = new Date(dateRange.endDate)
          end.setHours(23, 59, 59, 999)
          if (leadTime > end.getTime()) return false
        } else {
          // Single day selection: exact day
          const end = new Date(dateRange.startDate)
          end.setHours(23, 59, 59, 999)
          if (leadTime > end.getTime()) return false
        }
      }
    }

    return true
  })

  // Customer metrics calculations based on active filtered data
  const totalLeads = filteredLeads.length
  const hotLeads = filteredLeads.filter(
    (l) =>
      l.tags?.some((t) => t.includes('Yüksek') || t.includes('Nakit')) ||
      l.stage === 'OFFER' ||
      l.stage === 'APPOINTMENT'
  )
  const investors = filteredLeads.filter(
    (l) => l.tags?.some((t) => t.includes('Yatırım')) || ((l.budget ?? 0) >= 5000000)
  )
  const inFollowUp = filteredLeads.filter(
    (l) => l.stage === 'CONTACTED' || l.stage === 'APPOINTMENT' || l.stage === 'PRESENTATION'
  )
  const totalBudgetVolume = filteredLeads.reduce((acc, l) => acc + (l.budget || 0), 0)

  // Filtreler veya arama değiştiğinde 1. sayfaya dön
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedStage, selectedHousingType, dateRange, searchQuery, activeSubTab])

  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#b99881]/15 border border-[#b99881]/30 flex items-center justify-center text-[#b99881]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Müşteriler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Yatırımcı ve alıcı müşteri portföyünü, iletişim kanallarını, bütçelerini ve konut taleplerini yönetin.
          </p>
        </div>

        {/* Top Right Action: 'Verileri Al' + 'Yeni Müşteri' */}
        <div className="flex flex-wrap items-center gap-3">
          {pullFeedback && (
            <span
              className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 shadow-sm ${
                pullFeedback.isNew
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-medium'
                  : 'bg-[#282522] border-[#4a443f] text-[#d6beae]'
              }`}
            >
              {pullFeedback.isNew ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <RefreshCw className="w-3 h-3 text-[#b99881]" />
              )}
              <span>{pullFeedback.message}</span>
            </span>
          )}

          <button
            onClick={handlePullData}
            disabled={isPulling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            title="En son çekilen veriden sonraki yeni lead'leri buluttan anında çeker"
          >
            <DownloadCloud className={`w-3.5 h-3.5 text-[#b99881] ${isPulling ? 'animate-bounce text-amber-400' : ''}`} />
            <span>{isPulling ? 'Veriler Alınıyor...' : 'Verileri Al'}</span>
          </button>

          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenAddLead}
            className="rounded-full px-5 font-bold shadow-sm"
          >
            Yeni Müşteri
          </GlassButton>
        </div>
      </div>

      {/* KPI Metrics Row (Mobilde 2x2, Masaüstünde 4'lü) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-[11px] sm:text-xs text-[#a69f99] truncate block">Toplam Müşteri</span>
          <p className="text-lg sm:text-2xl font-bold text-white mt-1 truncate">
            {totalLeads} {leads.length !== totalLeads ? <span className="text-[11px] sm:text-xs text-[#a69f99] font-normal">/ {leads.length}</span> : ''}
          </p>
          <span className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 block truncate">
            Hacim: {formatCurrency(totalBudgetVolume)}
          </span>
        </div>

        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-[11px] sm:text-xs text-[#a69f99] truncate block">Sıcak Alıcılar</span>
          <p className="text-lg sm:text-2xl font-bold text-amber-400 mt-1 truncate">{hotLeads.length} alıcı</p>
          <span className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 block truncate">
            Nakit & yüksek alım
          </span>
        </div>

        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-[11px] sm:text-xs text-[#a69f99] truncate block">Yatırımcı Portföyü</span>
          <p className="text-lg sm:text-2xl font-bold text-[#b99881] mt-1 truncate">{investors.length} yatırımcı</p>
          <span className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 block truncate">
            Proje yatırımı
          </span>
        </div>

        <div className="p-3.5 sm:p-5 rounded-[22px] sm:rounded-[28px] bg-[#282522]/80 border border-[#4a443f] backdrop-blur-md">
          <span className="text-[11px] sm:text-xs text-[#a69f99] truncate block">Görüşme & Takip</span>
          <p className="text-lg sm:text-2xl font-bold text-sky-400 mt-1 truncate">{inFollowUp.length} müşteri</p>
          <span className="text-[10px] sm:text-[11px] text-[#8c857f] mt-1 block truncate">
            Randevu sürecinde
          </span>
        </div>
      </div>

      {/* Sub-Navigation & Filter Bar: Solid stacking context */}
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-4 py-1">
        {/* Left: View Mode Pills (Tablo / Kartlar) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[
            { id: 'leads-table' as const, label: 'Tablo', icon: Users },
            { id: 'leads-cards' as const, label: 'Kartlar', icon: Grid },
          ].map((tab) => {
            const Icon = tab.icon
            const isSelected = activeSubTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#b99881]/25 text-white font-bold border border-[#b99881]/50 shadow-sm'
                    : 'text-[#a69f99] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#b99881]' : 'text-[#8c857f]'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right: Filters & Meta-Style Date Range Picker */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <LuxurySelect
            label="Durum:"
            icon={<Filter className="w-3.5 h-3.5 text-[#b99881]" />}
            title="Aşama / Durum Filtrele"
            value={selectedStage}
            onChange={setSelectedStage}
            options={[
              { value: 'ALL', label: `Tüm Durumlar (${leads.length})` },
              ...Object.keys(STAGE_CONFIGS).map((k) => ({
                value: k,
                label: STAGE_CONFIGS[k as LeadStage].label,
              })),
            ]}
            align="right"
            minWidth="w-56"
          />

          <LuxurySelect
            label="Konut:"
            title="Konut Tipi Filtrele"
            value={selectedHousingType}
            onChange={setSelectedHousingType}
            options={[
              { value: 'ALL', label: 'Tüm Tipler' },
              { value: '1+1', label: '1+1 Daire' },
              { value: '2+1', label: '2+1 Daire' },
              { value: '3+1', label: '3+1 Daire' },
              { value: 'Villa', label: 'Villa / Müstakil' },
            ]}
            align="right"
            minWidth="w-52"
          />

          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            align="right"
          />
        </div>
      </div>

      {/* Sub-Tab 1: Müşteri Listesi / Tablosu */}
      {activeSubTab === 'leads-table' && (
        <div className="rounded-[32px] bg-[#282522]/70 border border-[#4a443f] overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-[#4a443f] text-[#a69f99] uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Müşteri Profili</th>
                  <th className="py-3.5 px-4">İletişim & WhatsApp</th>
                  <th className="py-3.5 px-4">Talep & Bütçe</th>
                  <th className="py-3.5 px-4">Müşteri Durumu</th>
                  <th className="py-3.5 px-4">Tarih</th>
                  <th className="py-3.5 px-4">Danışman</th>
                  <th className="py-3.5 px-5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a443f]/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#8c857f]">
                      {leads.length === 0
                        ? "Henüz kayıtlı müşteri bulunmuyor. Sağ üstteki 'Yeni Müşteri' butonuna tıklayarak ilk müşteriyi ekleyebilirsiniz."
                        : 'Kriterlere veya seçili tarih aralığına uygun müşteri bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => {
                    const stageConfig = STAGE_CONFIGS[lead.stage] || STAGE_CONFIGS.NEW

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        {/* Name & Tags */}
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white group-hover:text-[#b99881] transition-colors">
                            {lead.fullName}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {lead.tags?.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#d6beae] border border-white/5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Phone & Direct WhatsApp Link */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white">
                              {formatPhoneNumber(lead.phone)}
                            </span>
                            <a
                              href={generateWhatsAppUrl(lead.phone, `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy müşteri hizmetlerinden ulaşıyorum.`)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
                              title="WhatsApp Görüşmesi Aç"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1 rounded-full bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 transition-colors"
                              title="Telefonla Ara"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {lead.email && (
                            <span className="text-[11px] text-[#8c857f] block truncate max-w-[180px]">
                              {lead.email}
                            </span>
                          )}
                        </td>

                        {/* Demand & Budget */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {lead.preferredHousingType || 'Konut Belirtilmedi'}
                            </span>
                            {lead.budget && (
                              <GlassBadge variant="gold" size="sm">
                                {formatCurrency(lead.budget)}
                              </GlassBadge>
                            )}
                          </div>
                          <span className="text-[11px] text-[#8c857f] block mt-0.5 truncate max-w-[200px]">
                            {lead.formName || 'Meta Ads Formu'}
                          </span>
                        </td>

                        {/* Stage Dropdown */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <StageDropdown
                            value={lead.stage}
                            onChange={(newStage: LeadStage) => onStageChange(lead.id, newStage)}
                          />
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-[#a69f99]">
                          <span className="block font-mono text-[11px]">
                            {formatDate(lead.createdAt)}
                          </span>
                        </td>

                        {/* Assigned Consultant */}
                        <td className="py-3.5 px-4 text-[#a69f99]">
                          <span className="inline-block py-0.5 px-2 rounded-full bg-[#1e1b18] border border-[#4a443f]/60 text-[11px]">
                            {lead.assignedToUserName || lead.owner || 'Pazarlama Havuzu'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="px-3 py-1 rounded-full text-xs font-medium text-[#b99881] hover:text-white bg-[#b99881]/10 hover:bg-[#b99881]/25 border border-[#b99881]/30 transition-all cursor-pointer"
                          >
                            Detay
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalItems={filteredLeads.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Sub-Tab 2: Müşteri Kartları */}
      {activeSubTab === 'leads-cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#8c857f]">
              Kriterlere veya seçili tarih aralığına uygun müşteri bulunamadı.
            </div>
          ) : (
            paginatedLeads.map((lead) => {
              const stageConfig = STAGE_CONFIGS[lead.stage] || STAGE_CONFIGS.NEW

              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="p-5 rounded-[28px] bg-[#282522]/80 border border-[#4a443f] hover:border-[#b99881]/50 backdrop-blur-md transition-all cursor-pointer group space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white group-hover:text-[#b99881] transition-colors">
                        {lead.fullName}
                      </h4>
                      <p className="text-xs text-[#a69f99] font-mono mt-0.5">
                        {formatPhoneNumber(lead.phone)}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${stageConfig.color} ${stageConfig.bgLight} ${stageConfig.borderColor}`}>
                      {stageConfig.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#a69f99]">
                    <div className="flex justify-between">
                      <span>Talep Edilen:</span>
                      <span className="text-white font-medium">{lead.preferredHousingType || 'Belirtilmedi'}</span>
                    </div>
                    {lead.budget && (
                      <div className="flex justify-between">
                        <span>Bütçe Aralığı:</span>
                        <span className="text-amber-300 font-bold">{formatCurrency(lead.budget)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tarih:</span>
                      <span className="text-[#8c857f] font-mono">{formatDate(lead.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kaynak Form:</span>
                      <span className="text-white truncate max-w-[150px]">{lead.formName || 'Meta Form'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#4a443f]/50 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={generateWhatsAppUrl(lead.phone, `Merhaba Sayın ${lead.fullName}, Demirtürk Portföy'den yazıyorum.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-400 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${lead.phone}`}
                        className="p-1.5 rounded-full bg-[#34302d] hover:bg-white/10 text-[#a69f99] hover:text-white transition-colors"
                        title="Ara"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectLead(lead)}
                      className="text-xs text-[#d6beae] hover:text-white font-semibold transition-colors cursor-pointer"
                    >
                      Detay & Portföy →
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

          {/* Müşteri Kartları Sayfalama Çubuğu */}
          <PaginationBar
            totalItems={filteredLeads.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  )
}

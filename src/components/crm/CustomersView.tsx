import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageSquare,
  Layers,
  Sparkles,
  UserCheck,
  Check,
  X,
  UserPlus,
  ArrowRight,
  RefreshCw,
  FolderPlus,
  Edit3,
  DownloadCloud,
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Lead, LeadStage, STAGE_CONFIGS } from '@/types/lead'
import { StageDropdown } from './StageDropdown'
import { CallStatusDropdown } from './CallStatusDropdown'
import { CallCenterStatus } from '@/types/lead'
import { leadStore } from '@/services/leadStore'
import { metaStore } from '@/services/metaStore'
import { userStore, AppUser } from '@/services/userStore'
import { permissionService } from '@/services/permissionService'
import { formatCurrency, formatDate, formatDateOnly, formatTimeOnly, formatPhoneDisplay, generateWhatsAppUrl } from '@/utils/formatters'
import { DateRangePicker, DateRange } from '@/components/ui/DateRangePicker'
import { loadSavedDateRange, saveDateRange, checkDayRollover } from '@/services/dateFilterService'
import { PaginationBar } from '@/components/common/PaginationBar'

interface CustomTab {
  id: string
  name: string
  criteriaType: 'STAGE' | 'KEYWORD'
  criteriaValue: string
}

interface CustomersViewProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  currentUser?: AppUser | null
  onOpenNewLead?: () => void
}

const STORAGE_KEY_CUSTOM_TABS = 'demirturk_crm_custom_tabs'

export const CustomersView: React.FC<CustomersViewProps> = ({
  leads,
  onSelectLead,
  currentUser,
  onOpenNewLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  // "İletişimde" ilk sekme ve varsayılan
  const [filterStage, setFilterStage] = useState<string>('UNCONTACTED')

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

  // Custom Tabs state
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_TABS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [newTabCriteriaType, setNewTabCriteriaType] = useState<'STAGE' | 'KEYWORD'>('STAGE')
  const [newTabCriteriaValue, setNewTabCriteriaValue] = useState<string>('CONTACTED')

  // Modals
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<Lead | null>(null)
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string>('')
  const [assignNote, setAssignNote] = useState('')

  const [selectedLeadForConsultantChange, setSelectedLeadForConsultantChange] = useState<Lead | null>(null)
  const [selectedConsultantUserId, setSelectedConsultantUserId] = useState<string>('')

  const [selectedInquiryHistoryLead, setSelectedInquiryHistoryLead] = useState<Lead | null>(null)

  // Açıklama (Not) Düzenleme Modalı
  const [selectedLeadForNoteEdit, setSelectedLeadForNoteEdit] = useState<Lead | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  const handleOpenNoteEdit = (lead: Lead) => {
    setSelectedLeadForNoteEdit(lead)
    setEditingNoteText(lead.notes || '')
  }

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForNoteEdit) return
    leadStore.updateNotes(selectedLeadForNoteEdit.id, editingNoteText, currentUser)
    setSelectedLeadForNoteEdit(null)
  }

  // Manuel Verileri Al (Sol tık: Son 48 Saat, Sağ tık: Tarih Seçme Penceresi)
  const [isPulling, setIsPulling] = useState(false)
  const [pullFeedback, setPullFeedback] = useState<{ message: string; isNew: boolean } | null>(null)
  const [isPullDateModalOpen, setIsPullDateModalOpen] = useState(false)
  const [pullStartDate, setPullStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 48 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [pullEndDate, setPullEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [quickPageToken, setQuickPageToken] = useState<string>(() => metaStore.getConfig().pageAccessToken || '')
  const [quickPageId, setQuickPageId] = useState<string>(() => metaStore.getConfig().pageId || '')
  const csvFileInputRef = React.useRef<HTMLInputElement>(null)

  const handlePullData = async (customRange?: { startDate: Date; endDate: Date; label?: string }) => {
    if (isPulling) return
    setIsPulling(true)
    const start = customRange?.startDate || new Date(Date.now() - 48 * 60 * 60 * 1000)
    const end = customRange?.endDate || new Date()
    const rangeLabel = customRange?.label || 'Son 48 Saat'

    try {
      const result = await leadStore.pullLatestLeads({ startDate: start, endDate: end })
      // Yalnızca sağ tık ile özel tarih seçildiğinde tablo tarih filtresini o aralığa sabitle
      if (customRange) {
        setDateRange({
          presetKey: 'CUSTOM',
          presetLabel: rangeLabel,
          startDate: start,
          endDate: end,
        })
      }

      if (result.error) {
        setPullFeedback({
          message: result.error,
          isNew: false,
        })
      } else if (result.newCount > 0) {
        setPullFeedback({
          message: `${rangeLabel}: ${result.newCount} yeni müşteri başarıyla alındı!`,
          isNew: true,
        })
      } else if (result.updatedCount > 0) {
        setPullFeedback({
          message: `${rangeLabel}: ${result.updatedCount} müşteri kaydı güncellendi.`,
          isNew: true,
        })
      } else if (result.needsPageToken) {
        setPullFeedback({
          message: `${rangeLabel} bulut senkronu tamam. Meta form çekimi için sağ tıklayıp Sayfa Anahtarı veya CSV seçin.`,
          isNew: false,
        })
      } else {
        setPullFeedback({
          message: `${rangeLabel} verileri kontrol edildi. Tüm veriler güncel.`,
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
      }, 5500)
    }
  }

  const handleExecuteCustomRangePull = async (e: React.FormEvent) => {
    e.preventDefault()
    if (quickPageToken.trim() && quickPageToken.trim() !== metaStore.getConfig().pageAccessToken) {
      metaStore.saveConfig({ pageAccessToken: quickPageToken.trim(), isConnected: true })
    }
    const start = pullStartDate ? new Date(pullStartDate + 'T00:00:00') : new Date(Date.now() - 48 * 60 * 60 * 1000)
    const end = pullEndDate ? new Date(pullEndDate + 'T23:59:59') : new Date()
    setIsPullDateModalOpen(false)
    await handlePullData({
      startDate: start,
      endDate: end,
      label: `${pullStartDate} – ${pullEndDate}`,
    })
  }

  const handleImportMetaCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const start = pullStartDate ? new Date(pullStartDate + 'T00:00:00') : undefined
      const end = pullEndDate ? new Date(pullEndDate + 'T23:59:59') : undefined
      const imported = metaStore.importLeadsFromMetaCsvText(text, start, end)
      setIsPullDateModalOpen(false)
      if (start && end) {
        setDateRange({
          presetKey: 'CUSTOM',
          presetLabel: `${pullStartDate} – ${pullEndDate}`,
          startDate: start,
          endDate: end,
        })
      }
      setPullFeedback({
        message:
          imported.newCount > 0 || imported.mergedCount > 0
            ? `Meta dosyasından ${imported.newCount} yeni müşteri (${imported.mergedCount} güncelleme) aktarıldı!`
            : 'Seçilen tarih aralığında dosyada yeni müşteri bulunamadı.',
        isNew: imported.newCount > 0 || imported.mergedCount > 0,
      })
      setTimeout(() => setPullFeedback(null), 5500)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const allUsers = userStore.getAllUsers()
  const salesUsers = allUsers.filter((u) => (u.department === 'Satış' || u.departments?.includes('Satış')) && u.role !== 'ADMIN')
  const callCenterUsers = allUsers.filter(
    (u) => u.department === 'Müşteri İlişkileri' && u.role !== 'ADMIN' && !u.isManager
  )

  const handleManualAutoAssign = () => {
    if (callCenterUsers.length === 0) {
      return
    }
    leadStore.autoAssignCallCenterLeads(callCenterUsers)
  }

  // 1. Date Range Filter
  const dateFilteredLeads = leads.filter((l) => {
    if (dateRange.startDate) {
      const leadTime = new Date(l.createdAt).getTime()
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

  // Filter leads based on active tab & search
  const filteredLeads = dateFilteredLeads.filter((l) => {
    if (filterStage === 'UNCONTACTED') {
      // Yalnızca 3 Ekim ve sonrası iletişim kurulmamış (yeni) olanlar
      if (l.stage !== 'NEW') return false
      const leadTime = new Date(l.createdAt).getTime()
      const oct3Start = new Date('2026-10-02T21:00:00.000Z').getTime()
      if (leadTime < oct3Start) return false
    } else if (filterStage === 'QUALIFIED') {
      // Yalnızca nitelikli olduğu belirtilenler
      if (!l.isQualified && l.stage !== 'QUALIFIED') return false
    } else if (filterStage === 'ASSIGNED') {
      // Satışa atananlar
      if (!l.assignedToUserId) return false
    } else if (filterStage === 'CONVERTED') {
      // Dönüşüm (Satış olanlar)
      if (l.stage !== 'WON') return false
    } else if (filterStage.startsWith('custom-')) {
      const customTab = customTabs.find((t) => t.id === filterStage)
      if (customTab) {
        if (customTab.criteriaType === 'STAGE') {
          if (l.stage !== customTab.criteriaValue) return false
        } else if (customTab.criteriaType === 'KEYWORD') {
          const kw = customTab.criteriaValue.toLowerCase()
          const matched =
            l.fullName.toLowerCase().includes(kw) ||
            (l.preferredHousingType && l.preferredHousingType.toLowerCase().includes(kw)) ||
            (l.tags && l.tags.some((t) => t.toLowerCase().includes(kw))) ||
            l.formName.toLowerCase().includes(kw)
          if (!matched) return false
        }
      }
    }
    // filterStage === 'ALL' shows all

    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.fullName.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.formName.toLowerCase().includes(q) ||
      (l.preferredHousingType && l.preferredHousingType.toLowerCase().includes(q)) ||
      (l.assignedToUserName && l.assignedToUserName.toLowerCase().includes(q))
    )
  })

  // Filtreler veya arama değiştiğinde 1. sayfaya dön
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStage, searchQuery, dateRange])

  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Add custom tab
  const handleCreateCustomTab = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTabName.trim()) return

    const newTab: CustomTab = {
      id: `custom-${Date.now()}`,
      name: newTabName.trim(),
      criteriaType: newTabCriteriaType,
      criteriaValue: newTabCriteriaValue.trim(),
    }
    const updated = [...customTabs, newTab]
    setCustomTabs(updated)
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TABS, JSON.stringify(updated))
    } catch {}

    setFilterStage(newTab.id)
    setIsAddTabModalOpen(false)
    setNewTabName('')
  }

  const handleDeleteCustomTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customTabs.filter((t) => t.id !== tabId)
    setCustomTabs(updated)
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_TABS, JSON.stringify(updated))
    } catch {}
    if (filterStage === tabId) {
      setFilterStage('UNCONTACTED')
    }
  }

  // Stage changes directly from dropdown
  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    leadStore.updateStage(leadId, newStage, currentUser)
  }

  const handleCallStatusChange = (leadId: string, newCallStatus: CallCenterStatus) => {
    leadStore.updateCallStatus(leadId, newCallStatus, currentUser)
  }

  // Toggle [✓] Nitelikli checkbox
  const handleToggleQualified = (lead: Lead, checked: boolean) => {
    leadStore.toggleLeadQualified(lead.id, checked, currentUser)
  }

  // Execute assign to sales
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

  // Re-assign consultant
  const handleOpenConsultantChange = (lead: Lead) => {
    setSelectedLeadForConsultantChange(lead)
    setSelectedConsultantUserId(lead.assignedToUserId || callCenterUsers[0]?.id || '')
  }

  const handleExecuteConsultantChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForConsultantChange) return
    const targetUser = allUsers.find((u) => u.id === selectedConsultantUserId)
    if (targetUser) {
      leadStore.assignLeadToUser(selectedLeadForConsultantChange.id, targetUser, currentUser)
    }
    setSelectedLeadForConsultantChange(null)
  }

  const handleVerifyAi = (lead: Lead) => {
    if (!currentUser || !lead.aiEvaluation) return
    leadStore.verifyAiEvaluation(lead.id, currentUser, true)
  }

  // Counts for tabs (İletişimde shows only active 3 Ekim and onwards leads)
  const oct3Start = new Date('2026-10-02T21:00:00.000Z').getTime()
  const uncontactedCount = dateFilteredLeads.filter(
    (l) => l.stage === 'NEW' && new Date(l.createdAt).getTime() >= oct3Start
  ).length
  const qualifiedCount = dateFilteredLeads.filter((l) => l.isQualified || l.stage === 'QUALIFIED').length
  const assignedCount = dateFilteredLeads.filter((l) => Boolean(l.assignedToUserId)).length
  const convertedCount = dateFilteredLeads.filter((l) => l.stage === 'WON').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Müşteriler
            </h2>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Kişi kimliği, başvuru geçmişleri, çağrı merkezi eşit ataması, nitelik ve satış devir havuzu.
          </p>
        </div>

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
            onClick={() => handlePullData()}
            onContextMenu={(e) => {
              e.preventDefault()
              setIsPullDateModalOpen(true)
            }}
            disabled={isPulling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50 select-none"
            title="Sol Tık: Son 48 saatin verisini al • Sağ Tık: Tarih aralığı seç"
          >
            <DownloadCloud className={`w-3.5 h-3.5 text-[#b99881] ${isPulling ? 'animate-bounce text-amber-400' : ''}`} />
            <span>{isPulling ? 'Veriler Alınıyor...' : 'Verileri Al'}</span>
          </button>

          {callCenterUsers.length > 0 && permissionService.canAssignConsultant(currentUser ?? null) && (
            <button
              onClick={handleManualAutoAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm"
              title="Atanmamış tüm müşteri adaylarını çağrı merkezi ekibine eşit paylaştırır"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#b99881]" />
              <span>Çağrı Merkezi Eşit Dağıtımı Yap</span>
            </button>
          )}

          {onOpenNewLead && permissionService.canAddCustomer(currentUser ?? null) && (
            <GlassButton
              variant="gold"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenNewLead}
              className="rounded-full px-4 text-xs font-semibold"
            >
              Yeni Müşteri Ekle
            </GlassButton>
          )}
        </div>
      </div>

      {/* Tabs & Search Bar (Katmansız, Pill Shape) */}
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-4">
        {/* Tab Listesi: İletişimde (Varsayılan) -> Nitelikli -> Satışa Atanan -> Tümü -> Custom Tabs -> [+] */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {/* 1. Sekme: İletişimde (Yalnızca iletişim kurulmamış olanlar - NEW) */}
          <button
            onClick={() => setFilterStage('UNCONTACTED')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              filterStage === 'UNCONTACTED'
                ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
            }`}
          >
            İletişimde ({uncontactedCount})
          </button>

          {/* 2. Sekme: Nitelikli (Yalnızca nitelikli olduğu belirtilenler) */}
          <button
            onClick={() => setFilterStage('QUALIFIED')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              filterStage === 'QUALIFIED'
                ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
            }`}
          >
            Nitelikli ({qualifiedCount})
          </button>

          {/* 3. Sekme: Satışa Atanan */}
          <button
            onClick={() => setFilterStage('ASSIGNED')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              filterStage === 'ASSIGNED'
                ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
            }`}
          >
            Satışa Atanan ({assignedCount})
          </button>

          {/* 4. Sekme: Dönüşüm (Satış Olanlar) */}
          <button
            onClick={() => setFilterStage('CONVERTED')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              filterStage === 'CONVERTED'
                ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
            }`}
          >
            Dönüşüm ({convertedCount})
          </button>

          {/* 4. Sekme: Tümü */}
          <button
            onClick={() => setFilterStage('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              filterStage === 'ALL'
                ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
            }`}
          >
            Tümü ({dateFilteredLeads.length})
          </button>

          {/* Kullanıcının Kendi Eklediği Özel Sekmeler */}
          {customTabs.map((ct) => (
            <div
              key={ct.id}
              onClick={() => setFilterStage(ct.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === ct.id
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                  : 'text-[#a69f99] hover:text-white font-medium hover:bg-white/5'
              }`}
            >
              <span>{ct.name}</span>
              <button
                onClick={(e) => handleDeleteCustomTab(ct.id, e)}
                className="hover:text-rose-400 p-0.5 rounded-full"
                title="Sekmeyi Kaldır"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* + Butonu: Eleman oraya kendi sekmesini ekleyebilecek */}
          <button
            onClick={() => setIsAddTabModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#34302d] text-[#b99881] hover:text-white hover:bg-[#3d3733] border border-[#4a443f] text-xs font-bold cursor-pointer transition-colors shrink-0"
            title="Yeni Özel Sekme Ekle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sekme Ekle</span>
          </button>
        </div>

        {/* Sağ: Arama ve Tarih Seçimi */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Arama Alanı */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim, telefon veya konut ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          {/* Tarih Seçimi (Meta Stili Date Range Picker) */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            align="right"
          />
        </div>
      </div>

      {/* MÜŞTERİ TABLOSU: Katman & Kontür Çerçeve (Boşken Katmansız ve Ortalı) */}
      {filteredLeads.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <p className="text-sm font-semibold text-[#f3efe9]">
            Kayıtlı müşteri bulunamadı
          </p>
          <p className="text-xs text-[#a69f99] mt-1 max-w-md">
            Bu filtreye uygun müşteri kaydı bulunamadı.
          </p>
        </div>
      ) : (
        <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">
                  {/* 1. Kolon: Tarih */}
                  <th className="py-3 px-4">Tarih</th>
                  {/* 2. Kolon: Müşteri */}
                  <th className="py-3 px-4">Müşteri</th>
                  {/* 3. Kolon: İletişim */}
                  <th className="py-3 px-3 w-[170px] min-w-[170px]">İletişim</th>
                  {/* 4. Kolon: Atanan Danışman */}
                  <th className="py-3 px-4">Atanan Danışman</th>
                  {/* 5. Kolon: Açıklama */}
                  <th className="py-3 px-4">Açıklama</th>
                  {/* 6. Kolon: İşlemler */}
                  <th className="py-3 px-4">İşlemler</th>
                  {/* 7. Kolon: Aşama & Nitelik */}
                  <th className="py-3 px-4">Bilgi & Aşama</th>
                </tr>
              </thead>
              <tbody className="text-[#f3efe9]">
                {paginatedLeads.map((lead) => {
                const inquiryCount = lead.inquiries?.length || 1
                const hasAi = Boolean(lead.aiEvaluation)
                const isQualifiedLead = Boolean(lead.isQualified || lead.stage === 'QUALIFIED')

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-white/[0.03] transition-colors border-b border-[#4a443f]/60 last:border-b-0"
                  >
                      {/* 1. Kolon: Tarih & Saat */}
                      <td className="py-3 px-3 text-[#d6beae] whitespace-nowrap">
                        <div className="font-semibold text-white text-xs leading-tight">
                          {formatDateOnly(lead.createdAt)}
                        </div>
                        <div className="text-[9px] leading-tight text-[#8c857f] tabular-nums tracking-tight mt-0.5">
                          {formatTimeOnly(lead.createdAt)}
                        </div>
                      </td>

                      {/* 2. Kolon: Müşteri */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => onSelectLead(lead)}
                          className="font-bold text-white hover:text-[#b99881] cursor-pointer transition-colors text-xs select-text"
                          title="Detayları Görüntüle"
                        >
                          {lead.fullName}
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#8c857f]">
                            {lead.preferredHousingType || 'Konut'}
                          </span>
                          {(lead.source === 'WEBSITE' || lead.tags?.includes('Tanıtım Turu')) && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-semibold">
                              {lead.tags?.includes('Tanıtım Turu') || lead.formName?.toLowerCase().includes('tur') ? 'Web • Tanıtım Turu' : 'Web Sitesi'}
                            </span>
                          )}
                          {inquiryCount > 1 && (
                            <button
                              onClick={() => setSelectedInquiryHistoryLead(lead)}
                              className="px-1.5 py-0.5 rounded-full bg-[#b99881]/20 text-[#b99881] text-[9px] font-bold hover:bg-[#b99881]/30 cursor-pointer"
                              title="Tüm Başvuru Geçmişini Görüntüle"
                            >
                              {inquiryCount} Başvuru
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Kolon: İletişim */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-between w-[150px]">
                          <span className="font-mono text-xs text-[#f3efe9] select-all tracking-wide">
                            {formatPhoneDisplay(lead.phone)}
                          </span>
                          {lead.phone ? (
                            <a
                              href={generateWhatsAppUrl(lead.whatsappPhone || lead.phone, lead.fullName)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center shrink-0 ml-2"
                              title="WhatsApp Mesajı Gönder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="w-6 h-6" />
                          )}
                        </div>
                      </td>

                      {/* 4. Kolon: Atanan Danışman */}
                      <td className="py-3 px-3">
                        {lead.assignedToUserName ? (
                          <div
                            onClick={() => handleOpenConsultantChange(lead)}
                            className="flex items-center gap-2 group cursor-pointer"
                            title="Danışmanı Değiştir"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#b99881]/25 border border-[#b99881]/40 flex items-center justify-center text-[10px] font-bold text-white shrink-0 group-hover:border-[#b99881]">
                              {lead.assignedToUserName.charAt(0)}
                            </div>
                            <div className="text-white font-medium text-xs group-hover:text-[#b99881] transition-colors">
                              {lead.assignedToUserName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8c857f] text-xs font-mono select-none">-</span>
                        )}
                      </td>

                      {/* 5. Kolon: Açıklama (Call center notu / Açıklama ekle) */}
                      <td className="py-3 px-3">
                        {lead.notes && lead.notes.trim() ? (
                          <div
                            onClick={() => handleOpenNoteEdit(lead)}
                            className="group flex items-center gap-2 cursor-pointer max-w-[200px]"
                            title="Açıklamayı düzenlemek için tıklayın"
                          >
                            <span className="text-xs text-[#f3efe9] group-hover:text-[#b99881] truncate transition-colors select-text">
                              {lead.notes}
                            </span>
                            <Edit3 className="w-3 h-3 text-[#8c857f] group-hover:text-[#b99881] opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenNoteEdit(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d]/40 hover:bg-[#3d3733] border border-dashed border-[#4a443f] hover:border-[#b99881]/60 text-[#8c857f] hover:text-[#d6beae] text-[11px] font-medium transition-all cursor-pointer group"
                            title="Açıklama Ekle"
                          >
                            <Plus className="w-3 h-3 text-[#b99881] group-hover:scale-110 transition-transform" />
                            <span>Açıklama ekle</span>
                          </button>
                        )}
                      </td>

                      {/* 6. Kolon: İşlemler */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${lead.phone}`}
                            className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white transition-colors flex items-center justify-center shadow-sm"
                            title="Telefonla Ara"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#b99881]" />
                          </a>
                          <button
                            onClick={() => setSelectedInquiryHistoryLead(lead)}
                            className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                            title="Başvuru Geçmişi & Notlar"
                          >
                            <Layers className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                          <button
                            onClick={() => handleOpenAssign(lead)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-[#d6beae] hover:text-white border border-[#4a443f] hover:border-[#b99881]/60 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                            title="Satış Ekibine Devret"
                          >
                            <UserPlus className="w-3 h-3 text-amber-400" />
                            <span>Satışa Devret</span>
                          </button>
                        </div>
                      </td>

                      {/* 7. Kolon: Bilgi (Call Center) & Aşama (Meta) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {/* Call Center Bilgi Ayarı (Arandı, Tekrar Ara, Bilgi Verildi vb.) */}
                          <CallStatusDropdown
                            value={lead.callStatus || 'WAITING'}
                            onChange={(newCallStatus) => handleCallStatusChange(lead.id, newCallStatus)}
                          />

                          {/* Meta Hunisi Aşaması (Potansiyel Müşteri, İletişim, Nitelikli, Teklif, Dönüşüm, Potansiyel Değil) */}
                          <StageDropdown
                            value={lead.stage}
                            onChange={(newStage) => handleStageChange(lead.id, newStage)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Listenin Sonunda Ortalı Sayfalama ve Sağda Göster [20, 50, 100] İbaresi */}
          <PaginationBar
            totalItems={filteredLeads.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* SAĞ TIK: VERİLERİ AL TARİH SEÇME PENCERESİ */}
      <GlassModal
        isOpen={isPullDateModalOpen}
        onClose={() => setIsPullDateModalOpen(false)}
        title="Verileri Al — Tarih Aralığı Seçin"
        maxWidth="md"
      >
        <form onSubmit={handleExecuteCustomRangePull} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Hızlı aralık seçebilir veya özel başlangıç ve bitiş tarihi belirleyerek o döneme ait müşteri verilerini çekebilirsiniz.
          </p>

          {/* Hızlı Tarih Seçenekleri */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Son 24 Saat', hours: 24 },
              { label: 'Son 48 Saat', hours: 48 },
              { label: 'Son 7 Gün', hours: 24 * 7 },
              { label: 'Son 14 Gün', hours: 24 * 14 },
              { label: 'Son 30 Gün', hours: 24 * 30 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const end = new Date()
                  const start = new Date(Date.now() - preset.hours * 60 * 60 * 1000)
                  setPullStartDate(start.toISOString().slice(0, 10))
                  setPullEndDate(end.toISOString().slice(0, 10))
                }}
                className="px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#b99881] text-xs font-semibold text-[#d6beae] hover:text-white border border-[#4a443f] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Özel Başlangıç & Bitiş Tarihi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                required
                value={pullStartDate}
                onChange={(e) => setPullStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                required
                value={pullEndDate}
                onChange={(e) => setPullEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          {/* Meta Sayfa Erişim Anahtarı (Leads Retrieval) veya CSV İçeri Aktarım */}
          <div className="p-3.5 rounded-2xl bg-[#24211f]/60 border border-[#4a443f] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Meta Lead Ads Form Bağlantısı</span>
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                className="px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[11px] font-semibold text-[#b99881] hover:text-white cursor-pointer transition-colors"
              >
                CSV / Tablo Yükle
              </button>
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleImportMetaCsvFile}
                className="hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#a69f99] mb-1">
                Sayfa Erişim Anahtarı (Page Access Token - İsteğe Bağlı)
              </label>
              <input
                type="password"
                placeholder="Meta for Developers > Sayfa Tokenı (leads_retrieval yetkili)"
                value={quickPageToken}
                onChange={(e) => setQuickPageToken(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs font-mono text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <GlassButton
              variant="subtle"
              size="sm"
              type="button"
              onClick={() => setIsPullDateModalOpen(false)}
            >
              İptal
            </GlassButton>
            <GlassButton variant="gold" size="sm" type="submit" className="px-5 font-bold">
              Seçili Tarihteki Verileri Al
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ÖZEL SEKME EKLEME MODALI */}
      <GlassModal
        isOpen={isAddTabModalOpen}
        onClose={() => setIsAddTabModalOpen(false)}
        title="Yeni Özel Sekme Ekle"
      >
        <form onSubmit={handleCreateCustomTab} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Sekme Başlığı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Arananlar, Villa İlgilenenler, Kararsızlar"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Filtre Türü
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewTabCriteriaType('STAGE')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border text-center cursor-pointer transition-all ${
                  newTabCriteriaType === 'STAGE'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-[#24211f] text-[#a69f99] border-[#4a443f]'
                }`}
              >
                Aşama Bazlı
              </button>
              <button
                type="button"
                onClick={() => setNewTabCriteriaType('KEYWORD')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border text-center cursor-pointer transition-all ${
                  newTabCriteriaType === 'KEYWORD'
                    ? 'bg-[#b99881] text-white border-[#b99881]'
                    : 'bg-[#24211f] text-[#a69f99] border-[#4a443f]'
                }`}
              >
                Kelime / Konut Tipi
              </button>
            </div>
          </div>

          {newTabCriteriaType === 'STAGE' ? (
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Aşama Seçin
              </label>
              <StageDropdown
                value={newTabCriteriaValue as LeadStage}
                onChange={(newStage) => setNewTabCriteriaValue(newStage)}
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Filtrelenecek Kelime / Konut Tipi
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Villa, 2+1, Peşin, Rezidans"
                value={newTabCriteriaValue}
                onChange={(e) => setNewTabCriteriaValue(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
              />
            </div>
          )}

          <div className="pt-2 pb-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddTabModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs glass-button-subtle border border-[#4a443f] hover:border-[#b99881] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Sekmeyi Oluştur
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* DANIŞMAN DEĞİŞTİR / ATA MODALI */}
      <GlassModal
        isOpen={selectedLeadForConsultantChange !== null}
        onClose={() => setSelectedLeadForConsultantChange(null)}
        title={`Danışman Ata / Değiştir - ${selectedLeadForConsultantChange?.fullName}`}
      >
        <form onSubmit={handleExecuteConsultantChange} className="space-y-4">
          <div>
            <GlassSelect
              label="Atanacak Danışman (Çağrı Merkezi / Satış)"
              value={selectedConsultantUserId}
              onChange={setSelectedConsultantUserId}
              placeholder="Danışman seçin..."
              options={allUsers.map((u) => ({
                value: u.id,
                label: `${u.fullName} (${u.department} - ${u.role})`,
              }))}
            />
          </div>

          <div className="pt-2 pb-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedLeadForConsultantChange(null)}
              className="px-4 py-2 rounded-full text-xs glass-button-subtle border border-[#4a443f] hover:border-[#b99881] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Danışmanı Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* SATIŞA DEVRET MODALI */}
      <GlassModal
        isOpen={selectedLeadForAssign !== null}
        onClose={() => setSelectedLeadForAssign(null)}
        title={`Satış Danışmanına Ata - ${selectedLeadForAssign?.fullName}`}
      >
        <form onSubmit={handleExecuteAssign} className="space-y-4">
          <div>
            <GlassSelect
              label="Satış Temsilcisi Seçin *"
              value={selectedSalesUserId}
              onChange={setSelectedSalesUserId}
              placeholder="Satış temsilcisi seçin..."
              options={salesUsers.map((u) => ({
                value: u.id,
                label: `${u.fullName} (${u.role})`,
              }))}
            />
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

          <div className="pt-2 pb-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedLeadForAssign(null)}
              className="px-4 py-2 rounded-full text-xs glass-button-subtle border border-[#4a443f] hover:border-[#b99881] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Satış Ekibine Devret
            </GlassButton>
          </div>
        </form>
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
                    <span className="text-[10px] text-[#8c857f]">{formatDate(inq.createdAt)}</span>
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

      {/* AÇIKLAMA DÜZENLE MODALI */}
      <GlassModal
        isOpen={selectedLeadForNoteEdit !== null}
        onClose={() => setSelectedLeadForNoteEdit(null)}
        title={`Açıklama - ${selectedLeadForNoteEdit?.fullName}`}
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1.5">
              Müşteri Açıklaması / Çağrı Merkezi Notu
            </label>
            <textarea
              rows={4}
              value={editingNoteText}
              onChange={(e) => setEditingNoteText(e.target.value)}
              placeholder="Müşteri görüşmesi detayları, özel talepler veya geri arama notları girin..."
              className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881] transition-colors resize-none leading-relaxed"
              autoFocus
            />
          </div>

          <div className="pt-2 pb-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedLeadForNoteEdit(null)}
              className="px-4 py-2 rounded-full text-xs glass-button-subtle border border-[#4a443f] hover:border-[#b99881] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Açıklamayı Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}

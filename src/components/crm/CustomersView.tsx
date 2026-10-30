import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Users,
  Search,
  Plus,
  Phone,
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
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Bookmark,
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
import { formatCurrency, formatDate, formatDateOnly, formatTimeOnly, formatPhoneDisplay, generateWhatsAppUrl, formatSentenceNote } from '@/utils/formatters'
import { DateRangePicker, DateRange } from '@/components/ui/DateRangePicker'
import { loadSavedDateRange, saveDateRange, checkDayRollover } from '@/services/dateFilterService'
import { PaginationBar } from '@/components/common/PaginationBar'
import { BookLogo } from '@/components/common/BookLogo'
import { requestStore } from '@/services/requestStore'
import { notificationStore } from '@/services/notificationStore'

function isCallAgainLead(l: Lead): boolean {
  if (
    l.stage === 'QUALIFIED' ||
    l.stage === 'OFFER' ||
    l.stage === 'APPOINTMENT' ||
    l.stage === 'PRESENTATION' ||
    l.stage === 'WON' ||
    l.stage === 'LOST' ||
    l.stage === 'NO_INTENT' ||
    l.callStatus === 'NO_INTENT'
  ) {
    return false
  }
  return l.callStatus === 'CALL_AGAIN' || l.callStatus === 'UNREACHABLE'
}

function isWebLead(l: Lead): boolean {
  return Boolean(
    l.source === 'WEBSITE' ||
      l.channel?.toLowerCase().includes('web') ||
      l.formName?.toLowerCase().includes('tur') ||
      l.formName?.toLowerCase().includes('web') ||
      (l.tags && l.tags.some((t) => t.toLowerCase().includes('web') || t.toLowerCase().includes('tur')))
  )
}

function isGoogleLead(l: Lead): boolean {
  if (isWebLead(l)) return false
  return Boolean(
    l.source === 'GOOGLE_ADS' ||
      l.channel?.toLowerCase().includes('google') ||
      l.formName?.toLowerCase().includes('google')
  )
}

function isMetaLead(l: Lead): boolean {
  if (isWebLead(l) || isGoogleLead(l)) return false
  return Boolean(
    l.source === 'META_ADS' ||
      l.source === 'INSTAGRAM' ||
      l.source === 'FACEBOOK' ||
      l.channel?.toLowerCase().includes('meta') ||
      l.channel?.toLowerCase().includes('instagram') ||
      l.channel?.toLowerCase().includes('facebook') ||
      l.metaLeadId ||
      !l.source
  )
}

export function getLeadChannelLabel(lead: Lead): string {
  if (isWebLead(lead)) {
    const isTour =
      lead.tags?.includes('Tanıtım Turu') ||
      lead.formName?.toLowerCase().includes('tur') ||
      lead.channel?.toLowerCase().includes('tur')
    if (isTour) return 'Web Sitesi • Tanıtım Turu'
    if (lead.formName && !lead.formName.toLowerCase().includes('web sitesi')) {
      return `Web Sitesi • ${lead.formName}`
    }
    return 'Web Sitesi'
  }
  if (isGoogleLead(lead)) return 'Google'
  if (lead.source === 'WHATSAPP') return 'WhatsApp'
  if (lead.source === 'REFERRAL') return 'Referans'
  if (lead.source === 'DIRECT') return 'Doğrudan'
  return 'Meta'
}

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
  isMarketingView?: boolean
}

const STORAGE_KEY_CUSTOM_TABS = 'demirturk_crm_custom_tabs'
const STORAGE_KEY_MILESTONES = 'demirturk_crm_milestone_leads_v1'

function getLeadDayKey(dateStr?: string): string {
  if (!dateStr) return 'unknown'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 10)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface LeadSegment {
  id: string
  leads: Lead[]
  hasDayEndAfter: boolean
  hasMilestoneAfter: boolean
  milestoneLeadId?: string
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  leads,
  onSelectLead,
  currentUser,
  onOpenNewLead,
  isMarketingView = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  // Pazarlama'da varsayılan "Tümü" (ALL), Müşteri İlişkileri'nde "İletişimde" (UNCONTACTED)
  const [filterStage, setFilterStage] = useState<string>(() =>
    isMarketingView ? 'ALL' : 'UNCONTACTED'
  )

  useEffect(() => {
    setFilterStage(isMarketingView ? 'ALL' : 'UNCONTACTED')
  }, [isMarketingView])

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEv = e as CustomEvent<string>
      if (customEv.detail) {
        setFilterStage(customEv.detail)
      }
    }
    window.addEventListener('demirturk:switch-customer-stage-tab', handleSwitchTab)
    return () => window.removeEventListener('demirturk:switch-customer-stage-tab', handleSwitchTab)
  }, [])

  // Sıralama (Varsayılan: NEWEST - Yeniden Eskiye)
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC'>('NEWEST')

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

  // Dönüm (Son Kalınan Yer) İşaretleri ve Sağ Tık Bağlam Menüsü
  const [milestoneLeadIds, setMilestoneLeadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MILESTONES)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number
    y: number
    lead: Lead
  } | null>(null)

  useEffect(() => {
    const syncMilestones = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_MILESTONES)
        setMilestoneLeadIds(saved ? JSON.parse(saved) : [])
      } catch {
        // ignore
      }
    }
    window.addEventListener('demirturk:crm-milestones-updated', syncMilestones)
    return () => window.removeEventListener('demirturk:crm-milestones-updated', syncMilestones)
  }, [])

  useEffect(() => {
    if (!rowContextMenu) return
    const handleClose = () => setRowContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowContextMenu(null)
    }
    window.addEventListener('click', handleClose)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [rowContextMenu])

  const handleToggleMilestone = (leadId: string) => {
    setMilestoneLeadIds((prev) => {
      const exists = prev.includes(leadId)
      const next = exists ? prev.filter((id) => id !== leadId) : [...prev, leadId]
      try {
        localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent('demirturk:crm-milestones-updated'))
      } catch {
        // ignore
      }
      return next
    })
    setRowContextMenu(null)
  }
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
    setEditingNoteText(lead.notes ? formatSentenceNote(lead.notes) : '')
  }

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForNoteEdit) return
    const formatted = formatSentenceNote(editingNoteText)
    leadStore.updateNotes(selectedLeadForNoteEdit.id, formatted, currentUser)
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

  // Web sitesinden gelen müşteri talepleri (requestStore) varsa ve henüz lead olarak eklenmemişse Web Sitesi sekmesi için birleştir
  const allRequests = requestStore.getAll()
  const leadsWithWebRequests = React.useMemo(() => {
    const merged = [...leads]
    for (const req of allRequests) {
      const cleanReqPhone = String(req.customerPhone || '').replace(/\D/g, '').slice(-10)
      const exists = merged.some((l) => {
        if (l.id === req.id) return true
        const cleanLeadPhone = String(l.phone || '').replace(/\D/g, '').slice(-10)
        return Boolean(cleanReqPhone && cleanLeadPhone && cleanReqPhone === cleanLeadPhone && isWebLead(l))
      })
      if (!exists) {
        merged.unshift({
          id: req.id,
          fullName: req.customerName || 'Web Ziyaretçisi',
          phone: req.customerPhone || '',
          whatsappPhone: req.customerPhone || '',
          email: '',
          stage: 'NEW',
          callStatus: 'WAITING',
          owner: req.assignedToUserName || 'Atanmamış',
          source: 'WEBSITE',
          formName: req.subject || req.category || 'Web Sitesi Başvurusu',
          channel: `Web Sitesi / ${req.category || 'Başvuru'}`,
          preferredHousingType: req.subject || 'Web Başvurusu',
          budget: 0,
          notes: req.notes || req.subject || '',
          tags: ['Web Sitesi', req.category || 'Talep'],
          createdAt: req.createdAt || new Date().toISOString(),
          updatedAt: req.updatedAt || req.createdAt || new Date().toISOString(),
        })
      }
    }
    return merged
  }, [leads, allRequests])

  // 1. Date Range Filter
  const dateFilteredLeads = leadsWithWebRequests.filter((l) => {
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

  // Web Sitesi sekmesinde seçili dar tarih aralığında (örn. sadece Bugün) 0 kayıt varsa tüm web başvurularını göster
  const allWebLeadsInSystem = leadsWithWebRequests.filter(isWebLead)
  const dateFilteredWebLeads = dateFilteredLeads.filter(isWebLead)
  const effectiveWebLeads = dateFilteredWebLeads.length > 0 ? dateFilteredWebLeads : allWebLeadsInSystem
  const metaChannelCount = dateFilteredLeads.filter(isMetaLead).length
  const googleChannelCount = dateFilteredLeads.filter(isGoogleLead).length
  const webChannelCount = effectiveWebLeads.length

  const candidatePoolForFilter =
    filterStage === 'CHANNEL_WEB' && dateFilteredWebLeads.length === 0
      ? allWebLeadsInSystem
      : dateFilteredLeads

  // Filter leads based on active tab & search
  const filteredLeads = candidatePoolForFilter.filter((l) => {
    if (filterStage === 'CHANNEL_META') {
      if (!isMetaLead(l)) return false
    } else if (filterStage === 'CHANNEL_GOOGLE') {
      if (!isGoogleLead(l)) return false
    } else if (filterStage === 'CHANNEL_WEB') {
      if (!isWebLead(l)) return false
    } else if (filterStage === 'UNCONTACTED') {
      // İletişim: 3 Ekim ve sonrası yeni (NEW) veya İletişim (CONTACTED / UNDECIDED) aşamasındakiler (Tekrar Ara ve Potansiyel olmayanlar hariç)
      if (l.callStatus === 'NO_INTENT' || isCallAgainLead(l)) return false
      const isNewAfterOct3 =
        l.stage === 'NEW' &&
        new Date(l.createdAt).getTime() >= new Date('2026-10-02T21:00:00.000Z').getTime()
      const isContactedStage = l.stage === 'CONTACTED' || l.stage === 'UNDECIDED'
      if (!isNewAfterOct3 && !isContactedStage) return false
    } else if (filterStage === 'CALL_AGAIN') {
      // Tekrar Ara: Bilgi alanında "Tekrar ara" veya "Ulaşılamadı" seçilenler
      if (!isCallAgainLead(l)) return false
    } else if (filterStage === 'QUALIFIED') {
      // Nitelikli
      const isQual =
        l.stage === 'QUALIFIED' ||
        (Boolean(l.isQualified) &&
          l.stage !== 'OFFER' &&
          l.stage !== 'APPOINTMENT' &&
          l.stage !== 'PRESENTATION' &&
          l.stage !== 'WON' &&
          l.stage !== 'LOST' &&
          l.stage !== 'NO_INTENT')
      if (!isQual) return false
    } else if (filterStage === 'OFFER') {
      // Teklif (OFFER / APPOINTMENT / PRESENTATION)
      if (l.stage !== 'OFFER' && l.stage !== 'APPOINTMENT' && l.stage !== 'PRESENTATION') {
        return false
      }
    } else if (filterStage === 'CONVERTED') {
      // Dönüşüm (Satış olanlar)
      if (l.stage !== 'WON') return false
    } else if (filterStage === 'OTHER') {
      // Diğer (Potansiyel olmayanlar: LOST / NO_INTENT)
      if (l.stage !== 'LOST' && l.stage !== 'NO_INTENT' && l.callStatus !== 'NO_INTENT') {
        return false
      }
    } else if (filterStage === 'ASSIGNED') {
      // Satışa atananlar
      if (!l.assignedToUserId) return false
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
      getLeadChannelLabel(l).toLowerCase().includes(q) ||
      (l.notes && l.notes.toLowerCase().includes(q)) ||
      (l.assignedToUserName && l.assignedToUserName.toLowerCase().includes(q))
    )
  })

  // Sıralama uygula (Varsayılan: Yeniden eskiye)
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortOrder === 'NAME_ASC') {
      return (a.fullName || '').localeCompare(b.fullName || '', 'tr-TR')
    }
    if (sortOrder === 'NAME_DESC') {
      return (b.fullName || '').localeCompare(a.fullName || '', 'tr-TR')
    }
    const tA = new Date(a.createdAt || 0).getTime()
    const tB = new Date(b.createdAt || 0).getTime()
    const validA = !isNaN(tA) ? tA : 0
    const validB = !isNaN(tB) ? tB : 0
    if (validA !== validB) {
      return sortOrder === 'OLDEST' ? validA - validB : validB - validA
    }
    return sortOrder === 'OLDEST'
      ? (a.leadNumber || 0) - (b.leadNumber || 0)
      : (b.leadNumber || 0) - (a.leadNumber || 0)
  })

  // Filtreler, arama veya sıralama değiştiğinde 1. sayfaya dön
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStage, searchQuery, dateRange, sortOrder])

  const paginatedLeads = sortedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Gün bitişlerine ve "Dönüm" işaretlerine göre ayrı beyaz katmanlara böl
  const leadSegments: LeadSegment[] = []
  let currentSegmentLeads: Lead[] = []
  paginatedLeads.forEach((lead, idx) => {
    currentSegmentLeads.push(lead)
    const isLast = idx === paginatedLeads.length - 1
    const nextLead = !isLast ? paginatedLeads[idx + 1] : null
    const hasDayEndAfter = Boolean(
      nextLead && getLeadDayKey(lead.createdAt) !== getLeadDayKey(nextLead.createdAt)
    )
    const hasMilestoneAfter = milestoneLeadIds.includes(lead.id)

    if (isLast || hasDayEndAfter || hasMilestoneAfter) {
      leadSegments.push({
        id: `seg-${lead.id}-${idx}`,
        leads: currentSegmentLeads,
        hasDayEndAfter,
        hasMilestoneAfter,
        milestoneLeadId: hasMilestoneAfter ? lead.id : undefined,
      })
      currentSegmentLeads = []
    }
  })

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

  // Counts for tabs
  const oct3Start = new Date('2026-10-02T21:00:00.000Z').getTime()
  const uncontactedCount = dateFilteredLeads.filter(
    (l) =>
      l.callStatus !== 'NO_INTENT' &&
      !isCallAgainLead(l) &&
      ((l.stage === 'NEW' && new Date(l.createdAt).getTime() >= oct3Start) ||
        l.stage === 'CONTACTED' ||
        l.stage === 'UNDECIDED')
  ).length
  const callAgainCount = dateFilteredLeads.filter(isCallAgainLead).length
  const qualifiedCount = dateFilteredLeads.filter(
    (l) =>
      l.stage === 'QUALIFIED' ||
      (Boolean(l.isQualified) &&
        l.stage !== 'OFFER' &&
        l.stage !== 'APPOINTMENT' &&
        l.stage !== 'PRESENTATION' &&
        l.stage !== 'WON' &&
        l.stage !== 'LOST' &&
        l.stage !== 'NO_INTENT')
  ).length
  const offerCount = dateFilteredLeads.filter(
    (l) => l.stage === 'OFFER' || l.stage === 'APPOINTMENT' || l.stage === 'PRESENTATION'
  ).length
  const convertedCount = dateFilteredLeads.filter((l) => l.stage === 'WON').length
  const otherCount = dateFilteredLeads.filter(
    (l) => l.stage === 'LOST' || l.stage === 'NO_INTENT' || l.callStatus === 'NO_INTENT'
  ).length

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

          {(currentUser?.department === 'Yönetim' ||
            currentUser?.departments?.includes('Yönetim') ||
            currentUser?.role === 'ADMIN') && (
            <>
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

              {callCenterUsers.length > 0 && (
                <button
                  onClick={handleManualAutoAssign}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm"
                  title="Atanmamış tüm müşteri adaylarını çağrı merkezi ekibine eşit paylaştırır"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#b99881]" />
                  <span>Çağrı Merkezi Eşit Dağıtımı Yap</span>
                </button>
              )}
            </>
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
        {isMarketingView ? (
          /* PAZARLAMA SEKMELERİ: En solda Tümü (sadece ikon olarak), sonra Meta ve ikonu, Google ve ikonu, sonra Web Sitesi ve Demirtürk ikonu */
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {/* 1. En solda: Tümü (Sadece İkon Olarak) */}
            <button
              type="button"
              onClick={() => setFilterStage('ALL')}
              title={`Tümü (${dateFilteredLeads.length})`}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                filterStage === 'ALL'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10 shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
            </button>

            {/* 2. Sonra: Meta ve İkonu */}
            <button
              type="button"
              onClick={() => setFilterStage('CHANNEL_META')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'CHANNEL_META'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10 shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium border border-[#4a443f]'
              }`}
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
              </svg>
              <span>Meta ({metaChannelCount})</span>
            </button>

            {/* 3. Sonra: Google ve İkonu */}
            <button
              type="button"
              onClick={() => setFilterStage('CHANNEL_GOOGLE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'CHANNEL_GOOGLE'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10 shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium border border-[#4a443f]'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
              </svg>
              <span>Google ({googleChannelCount})</span>
            </button>

            {/* 4. Sonra: Web Sitesi ve Demirtürk İkonu */}
            <button
              type="button"
              onClick={() => setFilterStage('CHANNEL_WEB')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'CHANNEL_WEB'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10 shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium border border-[#4a443f]'
              }`}
            >
              <BookLogo animated={false} className="w-4 h-4 shrink-0" />
              <span>Web Sitesi ({webChannelCount})</span>
            </button>
          </div>
        ) : (
          /* MÜŞTERİ İLİŞKİLERİ SEKMELERİ: İletişim (Varsayılan) -> Tekrar Ara -> Nitelikli -> Teklif -> Dönüşüm -> Diğer (Potansiyel Olmayanlar) -> Tümü -> Custom Tabs -> [+] */
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {/* 1. Sekme: İletişim */}
            <button
              onClick={() => setFilterStage('UNCONTACTED')}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'UNCONTACTED'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
              }`}
            >
              İletişim ({uncontactedCount})
            </button>

            {/* 2. Sekme: Tekrar Ara (Tekrar ara + Ulaşılamadı bilgisi seçilenler, Saatlik hatırlatmalı) */}
            <button
              onClick={() => setFilterStage('CALL_AGAIN')}
              title="Tekrar ara ve Ulaşılamadı bilgisi seçilen müşteriler (Saatlik hatırlatma aktif)"
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'CALL_AGAIN'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
              }`}
            >
              Tekrar Ara ({callAgainCount})
            </button>

            {/* 3. Sekme: Nitelikli */}
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

            {/* 3. Sekme: Teklif */}
            <button
              onClick={() => setFilterStage('OFFER')}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'OFFER'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
              }`}
            >
              Teklif ({offerCount})
            </button>

            {/* 4. Sekme: Dönüşüm */}
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

            {/* 5. Sekme: Diğer (Potansiyel Olmayanlar) */}
            <button
              onClick={() => setFilterStage('OTHER')}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterStage === 'OTHER'
                  ? 'bg-[#b99881] text-white font-semibold border border-white/10'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white font-medium'
              }`}
              title="Potansiyel olmayan (Potansiyel Değil / Satın alma niyeti yok) kayıtlar"
            >
              Diğer ({otherCount})
            </button>

            {/* 6. Sekme: Tümü */}
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
        )}

        {/* Sağ: Arama ve Tarih Seçimi */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Arama Alanı */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İsim, telefon veya kanal ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          {/* Sıralama Seçimi (Varsayılan: Yeniden eskiye) */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#b99881] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC')
              }
              className="pl-8 pr-7 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
              title="Müşteri sıralama ölçütü"
            >
              <option value="NEWEST">Sırala: Yeniden eskiye</option>
              <option value="OLDEST">Sırala: Eskiden yeniye</option>
              <option value="NAME_ASC">Sırala: İsim (A - Z)</option>
              <option value="NAME_DESC">Sırala: İsim (Z - A)</option>
            </select>
          </div>

          {/* Tarih Seçimi (Meta Stili Date Range Picker) */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            align="right"
          />
        </div>
      </div>

      {filterStage === 'CALL_AGAIN' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#282522]/90 border border-[#b99881]/35 text-xs text-[#d6beae]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>
              <strong className="text-white">Saatlik Hatırlatma Aktif:</strong> Bilgi durumu{' '}
              <strong className="text-white">Tekrar ara</strong> veya{' '}
              <strong className="text-white">Ulaşılamadı</strong> olan müşteriler bu sekmede toplanır ve her saat başı bildirim gönderilir.
            </span>
          </div>
          {callAgainCount > 0 && (
            <button
              type="button"
              onClick={() => notificationStore.triggerCallAgainHourlyReminder(true)}
              className="px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[11px] font-semibold text-[#b99881] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Saatlik tekrar arama hatırlatma bildirimini şimdi gönder"
            >
              Şimdi Hatırlat
            </button>
          )}
        </div>
      )}

      {/* MÜŞTERİ TABLOSU: Günlere ve Dönümlere Göre Ayrı Beyaz Katmanlar & Arada Vurgu Rengi Çizgi */}
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
        <div className="space-y-0">
          {leadSegments.map((segment, segIdx) => (
            <React.Fragment key={segment.id}>
              {/* Her gün ve dönüm kendi beyaz katmanına sahiptir */}
              <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] overflow-hidden shadow-sm backdrop-blur-sm">
                <div className="w-full overflow-x-auto">
                  <table className="w-full table-fixed min-w-[1320px] text-xs text-left">
                    <colgroup>
                      <col className="w-[108px]" />
                      <col className="w-[195px]" />
                      <col className="w-[166px]" />
                      <col className="w-[148px]" />
                      <col className="w-[188px]" />
                      <col className="w-[180px]" />
                      <col className="w-[185px]" />
                      <col className="w-[195px]" />
                    </colgroup>
                    {segIdx === 0 && (
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">
                          {/* 1. Kolon: Tarih */}
                          <th className="py-3 px-3 w-[108px]">
                            <button
                              type="button"
                              onClick={() =>
                                setSortOrder((prev) => (prev === 'NEWEST' ? 'OLDEST' : 'NEWEST'))
                              }
                              className="no-layer-btn inline-flex items-center gap-1 text-[11px] font-semibold text-[#8c857f] hover:text-white cursor-pointer select-none"
                              title={
                                sortOrder === 'OLDEST'
                                  ? 'Şu an: Eskiden yeniye (Yeniden eskiye sıralamak için tıklayın)'
                                  : 'Şu an: Yeniden eskiye (Eskiden yeniye sıralamak için tıklayın)'
                              }
                            >
                              <span>Tarih</span>
                              {sortOrder === 'OLDEST' ? (
                                <ArrowUp className="w-3 h-3 text-[#b99881]" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-[#b99881]" />
                              )}
                            </button>
                          </th>
                          {/* 2. Kolon: Müşteri */}
                          <th className="py-3 px-3 w-[195px]">
                            <button
                              type="button"
                              onClick={() =>
                                setSortOrder((prev) => (prev === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC'))
                              }
                              className="no-layer-btn inline-flex items-center gap-1 text-[11px] font-semibold text-[#8c857f] hover:text-white cursor-pointer select-none"
                              title="İsme göre sırala"
                            >
                              <span>Müşteri</span>
                              {(sortOrder === 'NAME_ASC' || sortOrder === 'NAME_DESC') && (
                                sortOrder === 'NAME_ASC' ? (
                                  <ArrowUp className="w-3 h-3 text-[#b99881]" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-[#b99881]" />
                                )
                              )}
                            </button>
                          </th>
                          {/* 3. Kolon: İletişim */}
                          <th className="py-3 px-3 w-[166px]">İletişim</th>
                          {/* 4. Kolon: Atanan Danışman */}
                          <th className="py-3 px-3 w-[148px]">Atanan Danışman</th>
                          {/* 5. Kolon: Bilgi */}
                          <th className="py-3 px-3 w-[188px]">Bilgi</th>
                          {/* 6. Kolon: Aşama */}
                          <th className="py-3 px-3 w-[180px]">Aşama</th>
                          {/* 7. Kolon: Açıklama */}
                          <th className="py-3 px-3 w-[185px]">Açıklama</th>
                          {/* 8. Kolon: İşlemler */}
                          <th className="py-3 px-3 w-[195px]">İşlemler</th>
                        </tr>
                      </thead>
                    )}
                    <tbody className="text-[#f3efe9]">
                      {segment.leads.map((lead) => {
                        const inquiryCount = lead.inquiries?.length || 1

                        return (
                          <tr
                            key={lead.id}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              setRowContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                lead,
                              })
                            }}
                            className="customer-table-row transition-colors border-b border-[#4a443f]/60 last:border-b-0"
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
                            <td className="py-3 px-3 overflow-hidden">
                              <div
                                onClick={() => onSelectLead(lead)}
                                className="font-bold text-white hover:text-[#b99881] cursor-pointer transition-colors text-xs select-text truncate"
                                title="Detayları Görüntüle"
                              >
                                {lead.fullName}
                              </div>
                              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                <span className="text-[10px] text-[#8c857f] truncate">
                                  {getLeadChannelLabel(lead)}
                                </span>
                                {inquiryCount > 1 && (
                                  <button
                                    onClick={() => setSelectedInquiryHistoryLead(lead)}
                                    className="px-1.5 py-0.5 rounded-full bg-[#b99881]/20 text-[#b99881] text-[9px] font-bold hover:bg-[#b99881]/30 cursor-pointer shrink-0"
                                    title="Tüm Başvuru Geçmişini Görüntüle"
                                  >
                                    {inquiryCount} Başvuru
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 3. Kolon: İletişim & WhatsApp İkonu */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center justify-between w-[146px]">
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
                                    <svg
                                      className="w-3.5 h-3.5 shrink-0"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M12.031 2.01c-5.518 0-9.998 4.48-9.998 9.998 0 1.763.46 3.485 1.334 5.003L2 22l5.122-1.343a9.956 9.956 0 0 0 4.909 1.298h.004c5.517 0 9.997-4.48 9.997-9.998 0-2.671-1.04-5.182-2.928-7.07A9.935 9.935 0 0 0 12.031 2.01Zm5.847 14.307c-.246.693-1.434 1.326-1.997 1.41-.513.076-1.163.109-1.878-.118-.433-.138-.988-.321-1.7-.628-2.993-1.292-4.947-4.306-5.097-4.505-.149-.2-1.216-1.618-1.216-3.086 0-1.468.769-2.19 1.042-2.489.274-.298.597-.373.796-.373.199 0 .398.002.572.01.183.009.429-.07.671.512.248.597.845 2.065.92 2.214.075.15.124.324.025.523-.099.199-.149.323-.298.497-.15.174-.314.389-.448.523-.149.149-.304.311-.131.609.174.298.773 1.275 1.66 2.065 1.14.996 2.101 1.305 2.4 1.454.298.15.472.125.646-.075.174-.199.746-.87.945-1.169.199-.298.398-.248.671-.149.274.1 1.741.821 2.039.97.298.149.497.224.572.348.075.125.075.722-.171 1.415Z" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="w-6 h-6" />
                                )}
                              </div>
                            </td>

                            {/* 4. Kolon: Atanan Danışman */}
                            <td className="py-3 px-3 overflow-hidden">
                              {lead.assignedToUserName ? (
                                <div
                                  onClick={() => handleOpenConsultantChange(lead)}
                                  className="flex items-center gap-2 group cursor-pointer min-w-0"
                                  title="Danışmanı Değiştir"
                                >
                                  <div className="w-6 h-6 rounded-full bg-[#b99881]/25 border border-[#b99881]/40 flex items-center justify-center text-[10px] font-bold text-white shrink-0 group-hover:border-[#b99881]">
                                    {lead.assignedToUserName.charAt(0)}
                                  </div>
                                  <div className="text-white font-medium text-xs group-hover:text-[#b99881] transition-colors truncate">
                                    {lead.assignedToUserName}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[#8c857f] text-xs font-mono select-none">-</span>
                              )}
                            </td>

                            {/* 5. Kolon: Bilgi (Call Center) */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <CallStatusDropdown
                                value={lead.callStatus || 'WAITING'}
                                onChange={(newCallStatus) => handleCallStatusChange(lead.id, newCallStatus)}
                              />
                            </td>

                            {/* 6. Kolon: Aşama (Meta Hunisi) */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <StageDropdown
                                value={lead.stage}
                                onChange={(newStage) => handleStageChange(lead.id, newStage)}
                              />
                            </td>

                            {/* 7. Kolon: Açıklama (Call center notu / Açıklama ekle) */}
                            <td className="py-3 px-3 overflow-hidden">
                              {lead.notes && lead.notes.trim() ? (
                                <div
                                  onClick={() => handleOpenNoteEdit(lead)}
                                  className="group flex items-center gap-2 cursor-pointer max-w-full min-w-0"
                                  title="Açıklamayı düzenlemek için tıklayın"
                                >
                                  <span className="text-xs text-[#f3efe9] group-hover:text-[#b99881] truncate transition-colors select-text">
                                    {formatSentenceNote(lead.notes)}
                                  </span>
                                  <Edit3 className="w-3 h-3 text-[#8c857f] group-hover:text-[#b99881] opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenNoteEdit(lead)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d]/40 hover:bg-[#3d3733] border border-dashed border-[#4a443f] hover:border-[#b99881]/60 text-[#8c857f] hover:text-[#d6beae] text-[11px] font-medium transition-all cursor-pointer group whitespace-nowrap"
                                  title="Açıklama Ekle"
                                >
                                  <Plus className="w-3 h-3 text-[#b99881] group-hover:scale-110 transition-transform shrink-0" />
                                  <span>Açıklama ekle</span>
                                </button>
                              )}
                            </td>

                            {/* 8. Kolon: İşlemler */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white transition-colors flex items-center justify-center shadow-sm shrink-0"
                                  title="Telefonla Ara"
                                >
                                  <Phone className="w-3.5 h-3.5 text-[#b99881]" />
                                </a>
                                <button
                                  onClick={() => setSelectedInquiryHistoryLead(lead)}
                                  className="p-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-[#d6beae] hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-sm shrink-0"
                                  title="Başvuru Geçmişi & Notlar"
                                >
                                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                                </button>
                                <button
                                  onClick={() => handleOpenAssign(lead)}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3d3733] text-[#d6beae] hover:text-white border border-[#4a443f] hover:border-[#b99881]/60 text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap shrink-0"
                                  title="Satış Ekibine Devret"
                                >
                                  <UserPlus className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>Satışa Devret</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Katmanlar Arası (Gri Arka Plan Üzerinde) Gün Sonu ve Dönüm Vurgu Çizgisi */}
              {(segment.hasMilestoneAfter || segment.hasDayEndAfter) && (
                <div className="py-2.5 flex flex-col items-center justify-center gap-1.5 select-none">
                  {segment.hasMilestoneAfter && (
                    <div
                      onContextMenu={(e) => {
                        if (!segment.milestoneLeadId) return
                        e.preventDefault()
                        e.stopPropagation()
                        const leadObj = paginatedLeads.find((l) => l.id === segment.milestoneLeadId)
                        if (leadObj) {
                          setRowContextMenu({ x: e.clientX, y: e.clientY, lead: leadObj })
                        }
                      }}
                      title="Dönüm noktası (Son kalınan yer) — Sağ tık ile yönetin"
                      className="crm-segment-divider-line is-milestone-line cursor-context-menu"
                    />
                  )}
                  {segment.hasDayEndAfter && (
                    <div
                      title="Gün sonu ayrımı"
                      className="crm-segment-divider-line"
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Listenin Sonunda Ortalı Sayfalama ve Sağda Göster [20, 50, 100] İbaresi */}
          <div className="pt-2">
            <div className="rounded-[24px] bg-[#282522]/80 border border-[#4a443f] px-3 py-1 shadow-sm backdrop-blur-sm">
              <PaginationBar
                totalItems={filteredLeads.length}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                className="border-t-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* MÜŞTERİ SATIRI SAĞ TIK BAĞLAM MENÜSÜ: DÖNÜM OLARAK AYARLA */}
      {rowContextMenu &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${Math.min(rowContextMenu.y, window.innerHeight - 90)}px`,
              left: `${Math.min(rowContextMenu.x, window.innerWidth - 220)}px`,
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="dropdown-panel context-menu rounded-[16px] backdrop-blur-2xl p-1.5 min-w-[195px] border border-[#4a443f] shadow-xl"
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold text-[#8c857f] truncate border-b border-[#4a443f]/40 mb-1">
              {rowContextMenu.lead.fullName}
            </div>
            <button
              type="button"
              onClick={() => handleToggleMilestone(rowContextMenu.lead.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:bg-[#34302d] cursor-pointer transition-colors text-left"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
              <span>
                {milestoneLeadIds.includes(rowContextMenu.lead.id)
                  ? 'Dönümü Kaldır'
                  : 'Dönüm Olarak Ayarla'}
              </span>
            </button>
          </div>,
          document.body
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
        title={`Açıklama: ${selectedLeadForNoteEdit?.fullName}`}
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

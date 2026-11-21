import { visibleDepartment } from '@/types/teamDirectory'
import React, { useState, useEffect } from 'react'
import { usePersonalTools } from '@/services/personalToolWorkspace'
import { LeadChannelIcon, manualChannels } from './LeadChannelIcon'
import './customers-list.css'
import { CustomSelect } from '@/components/ui/CustomSelect'
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
  Trash2,
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { OverflowTabs } from '@/components/ui/OverflowTabs'
import { Lead, LeadStage, STAGE_CONFIGS, isLeadHandedOverToSales } from '@/types/lead'
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
import { MetaSendButton } from './MetaSendButton'

const rowMenuItemClass = 'flex w-full items-center gap-2 rounded-full bg-transparent px-3 py-1.5 text-left text-xs font-semibold focus-visible:outline-offset-1'

const isFirstContact = (lead: Lead) => !lead.stage || lead.stage === 'NEW'
// Eski UNDECIDED kayıtlarının Aşama alanı da İletişim olarak gösterilir.
const isContacted = (lead: Lead) => lead.stage === 'CONTACTED' || lead.stage === 'UNDECIDED'

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
  if (lead.source === 'DIRECT') return manualChannels.find(channel=>channel===lead.channel) || 'Direkt'
  return 'Meta'
}

interface CustomTab {
  id: string
  name: string
  criteriaType: 'STAGE' | 'KEYWORD' | 'MANUAL'
  leadIds?: string[]
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
  const [filterStage, setFilterStage] = useState<string>(() =>
    isMarketingView ? 'ALL' : 'NEW'
  )

  useEffect(() => {
    setFilterStage(isMarketingView ? 'ALL' : 'NEW')
  }, [isMarketingView])

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEv = e as CustomEvent<string>
      if (customEv.detail) {
        setFilterStage(customEv.detail === 'UNCONTACTED' ? 'NEW' : customEv.detail)
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
  const [dateRange, setDateRangeState] = useState<DateRange>(() => isMarketingView ? loadSavedDateRange() : {startDate:null,endDate:null,presetKey:'ALL'})

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range)
    if (isMarketingView) saveDateRange(range)
  }

  useEffect(() => {
    const showSaved = (event: Event) => {
      const saved = (event as CustomEvent<Lead>).detail
      if (!saved?.createdAt) return
      setFilterStage(!isMarketingView && isFirstContact(saved) ? 'NEW' : 'ALL')
      setSearchQuery('')
      setCurrentPage(1)
      setSortOrder('NEWEST')
      const date = new Date(saved.createdAt)
      const start = dateRange.startDate ? new Date(dateRange.startDate).setHours(0, 0, 0, 0) : -Infinity
      const end = dateRange.endDate ? new Date(dateRange.endDate).setHours(23, 59, 59, 999) : Infinity
      if (date.getTime() < start || date.getTime() > end) setDateRange({
        startDate: new Date(date.getFullYear(), date.getMonth(), 1),
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        presetKey: 'THIS_MONTH', presetLabel: 'Bu Ay',
      })
    }
    window.addEventListener('demirturk:manual-lead-saved', showSaved)
    return () => window.removeEventListener('demirturk:manual-lead-saved', showSaved)
  }, [dateRange, isMarketingView])

  // Check if midnight passed while app was running to adapt 'Bugün' dynamically to the new day
  useEffect(() => {
    const handleCheckRollover = () => {
      const rollover = checkDayRollover(dateRange)
      if (rollover) {
        setDateRangeState(rollover)
        if (isMarketingView) saveDateRange(rollover)
      }
    }
    const interval = setInterval(handleCheckRollover, 30000)
    window.addEventListener('focus', handleCheckRollover)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleCheckRollover)
    }
  }, [dateRange,isMarketingView])

  // Custom Tabs state
  const preferences=usePersonalTools(currentUser?.id||'',!isMarketingView)
  const [customTabs,setCustomTabs]=preferences.field<CustomTab[]>('customerTabs',()=>{
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM_TABS)||'[]') as CustomTab[]).filter(t=>t.criteriaType==='STAGE'||t.criteriaType==='KEYWORD').map(({id,name,criteriaType,criteriaValue})=>({id,name,criteriaType,criteriaValue})) }
    catch { return [] }
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
  const [moveMenu,setMoveMenu]=useState<{x:number;y:number}|null>(null)
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number
    y: number
    lead: Lead
  } | null>(null)
  useEffect(()=>{setMoveMenu(null)},[rowContextMenu])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  useEffect(() => { setSelectedIds(new Set()); setSelectionMode(false); setRowContextMenu(null); setDeleteTargets([]); setDeleteError('') }, [currentUser?.id])
  useEffect(() => {
    const allowed = new Set(leads.map(lead => lead.id))
    setSelectedIds(old => {
      const next = new Set([...old].filter(id => allowed.has(id)))
      return next.size === old.size ? old : next
    })
  }, [leads])
  function toggleSelected(id: string) {
    setSelectedIds(old => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  async function confirmDelete() {
    if (deleting) return
    setDeleting(true); setDeleteError('')
    try {
      if (await leadStore.archiveLeads(deleteTargets)) {
        setSelectedIds(new Set()); setSelectionMode(false); setDeleteTargets([])
      } else setDeleteError(leadStore.getReadError() || 'Seçilen kayıtlar silinemedi. Listeyi kontrol edin.')
    } finally { setDeleting(false) }
  }

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
  const [newTabCriteriaType, setNewTabCriteriaType] = useState<'STAGE' | 'KEYWORD' | 'MANUAL'>('MANUAL')
  const [newTabCriteriaValue, setNewTabCriteriaValue] = useState<string>('CONTACTED')

  // Modals
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<Lead | null>(null)
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string>('')
  const [assignNote, setAssignNote] = useState('')

  const [selectedLeadForConsultantChange, setSelectedLeadForConsultantChange] = useState<Lead | null>(null)
  const [selectedConsultantUserId, setSelectedConsultantUserId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [consultantChangeError, setConsultantChangeError] = useState('')
  const representativeView = currentUser?.role !== 'ADMIN' && currentUser?.department === 'Müşteri İlişkileri'

  const [selectedInquiryHistoryLead, setSelectedInquiryHistoryLead] = useState<Lead | null>(null)

  // Açıklama (Not) Düzenleme Modalı
  const [selectedLeadForNoteEdit, setSelectedLeadForNoteEdit] = useState<Lead | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  const handleOpenNoteEdit = (lead: Lead) => {
    setSelectedLeadForNoteEdit(lead)
    setEditingNoteText(lead.notes ? formatSentenceNote(lead.notes) : '')
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForNoteEdit) return
    const formatted = formatSentenceNote(editingNoteText)
    const id = selectedLeadForNoteEdit.id
    if (await leadStore.updateNotes(id, formatted, currentUser)) {
      setSelectedLeadForNoteEdit(previous => previous?.id === id ? null : previous)
    }
  }

  // Sol tık sunucudaki son Meta kaydından devam eder; sağ tık tarih seçimini açar.
  const [isPulling, setIsPulling] = useState(false)
  const pullFeedbackTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (pullFeedbackTimer.current) clearTimeout(pullFeedbackTimer.current) }, [])
  const [pullFeedback, setPullFeedback] = useState<{ message: string; isNew: boolean } | null>(null)
  const [isPullDateModalOpen, setIsPullDateModalOpen] = useState(false)
  const [assignmentStart, setAssignmentStart] = useState('')
  useEffect(() => {
    let active = true
    setAssignmentStart('')
    if (!isPullDateModalOpen) return
    const client = userStore.getServerClient()
    if (!client?.rpc) return
    void (async () => {
      try {
        const { data, error } = await client.rpc('crm_meta_distribution_policy').abortSignal(AbortSignal.timeout(15000))
        if (active && !error && data?.assignment_from && Number.isFinite(Date.parse(data.assignment_from))) setAssignmentStart(new Date(data.assignment_from).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }))
      } catch { /* Assignment limits are enforced on the server even if this hint cannot load. */ }
    })()
    return () => { active = false }
  }, [isPullDateModalOpen, currentUser?.id])
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
    if (pullFeedbackTimer.current) { clearTimeout(pullFeedbackTimer.current); pullFeedbackTimer.current = null }
    setIsPulling(true)
    const start = customRange?.startDate || new Date(Date.now() - 48 * 60 * 60 * 1000)
    const end = customRange?.endDate || new Date()
    const rangeLabel = customRange?.label || 'Son Meta kaydından itibaren'

    try {
      setPullFeedback({message:'Veri alımı başlatılıyor…',isNew:false})
      const result = await leadStore.pullLatestLeads({ ...(customRange ? { startDate: start, endDate: end } : {}),
        onProgress:message=>setPullFeedback({message,isNew:false}) })
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
      pullFeedbackTimer.current = setTimeout(() => {
        setPullFeedback(null)
        pullFeedbackTimer.current = null
      }, 5500)
    }
  }

  const handleExecuteCustomRangePull = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const handleManualAutoAssign = async () => {
    if (callCenterUsers.length === 0) {
      return
    }
    try { await leadStore.autoAssignCallCenterLeads(callCenterUsers) }
    catch (error) { setPullFeedback({ message: error instanceof Error ? error.message : 'Dağıtım tamamlanamadı.', isNew: false }) }
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
    return merged.filter(lead => permissionService.canAccessLead(currentUser || null, lead))
  }, [leads, allRequests, currentUser])

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
    } else if (filterStage === 'NEW') {
      if (!isFirstContact(l)) return false
    } else if (filterStage === 'CONTACTED') {
      if (!isContacted(l)) return false
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
      const placed=customTabs.find(t=>t.leadIds?.includes(l.id))
      if (placed && placed.id!==filterStage) return false
      if (customTab && !placed) {
        if (customTab.criteriaType === 'MANUAL' && !customTab.leadIds?.includes(l.id)) return false
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

  function moveToTab(id:string,leadId:string) {
    const updated=customTabs.map(t=>({...t,leadIds:[...(t.leadIds||[]).filter(x=>x!==leadId),...(t.id===id?[leadId]:[])]}))
    setCustomTabs(updated)
    setRowContextMenu(null)
  }
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

    setFilterStage(newTab.id)
    setIsAddTabModalOpen(false)
    setNewTabName('')
  }

  const handleDeleteCustomTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customTabs.filter((t) => t.id !== tabId)
    setCustomTabs(updated)
    if (filterStage === tabId) {
      setFilterStage(isMarketingView ? 'ALL' : 'NEW')
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

  // Execute manual handover to sales ("Satışa Devret")
  const handleOpenAssign = (lead: Lead) => {
    setSelectedLeadForAssign(lead)
    setSelectedSalesUserId(lead.salesRepUserId || 'ALL_SALES')
    setAssignNote('')
  }

  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAssign || !currentUser) return

    const targetUser =
      selectedSalesUserId && selectedSalesUserId !== 'ALL_SALES'
        ? allUsers.find((u) => u.id === selectedSalesUserId) || null
        : null

    if (selectedSalesUserId !== 'ALL_SALES' && !targetUser) return
    const id = selectedLeadForAssign.id
    if (await leadStore.assignToSales(id, targetUser, currentUser, assignNote)) {
      setSelectedLeadForAssign(previous => previous?.id === id ? null : previous)
    }
  }

  const handleRevokeSalesHandover = async (lead: Lead) => {
    if (!currentUser) return
    if (await leadStore.revokeSalesHandover(lead.id, currentUser)) {
      setSelectedLeadForAssign(previous => previous?.id === lead.id ? null : previous)
    }
  }

  // Re-assign consultant
  const handleOpenConsultantChange = (lead: Lead) => {
    if (representativeView && lead.assignedToUserId !== currentUser?.id) return
    setSelectedLeadForConsultantChange(lead)
    setConsultantChangeError('')
    setSelectedConsultantUserId(representativeView ? '' : lead.assignedToUserId || callCenterUsers[0]?.id || '')
  }

  const handleExecuteConsultantChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForConsultantChange) return
    if (transferring) return
    const targetUser = allUsers.find((u) => u.id === selectedConsultantUserId)
    const id = selectedLeadForConsultantChange.id
    setTransferring(true)
    try {
      const success = targetUser && (representativeView
        ? await leadStore.transferToRepresentative(id, targetUser.id)
        : await leadStore.assignLeadToUser(id, targetUser, currentUser))
      if (success) setSelectedLeadForConsultantChange(previous => previous?.id === id ? null : previous)
      else setConsultantChangeError(leadStore.getReadError() || 'Devir tamamlanamadı. Kaydı yenileyip tekrar deneyin.')
    } finally { setTransferring(false) }
  }

  const handleVerifyAi = (lead: Lead) => {
    if (!currentUser || !lead.aiEvaluation) return
    leadStore.verifyAiEvaluation(lead.id, currentUser, true)
  }

  // Counts for tabs
  const firstContactCount = dateFilteredLeads.filter(isFirstContact).length
  const contactedCount = dateFilteredLeads.filter(isContacted).length
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
  const canUseMetaActions = currentUser?.department === 'Yönetim' ||
    currentUser?.departments?.includes('Yönetim') || currentUser?.role === 'ADMIN'
  const showSendToolbar = isMarketingView && canUseMetaActions

  return (
    <div className="space-y-6">
      {preferences.state.error&&!isMarketingView&&<p role="alert">{preferences.state.error} {preferences.state.conflict?<><button onClick={()=>preferences.resolve(false)}>Sunucudakini kullan</button> · <button onClick={()=>preferences.resolve(true)}>Düzenlememi kaydet</button></>:<button onClick={preferences.retry}>Tekrar dene</button>}</p>}
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 ${showSendToolbar ? 'customer-send-header' : ''}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#b99881]" />
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Müşteriler
            </h2>
          </div>
        </div>

        <div className={showSendToolbar ? 'customer-send-actions' : 'flex flex-wrap items-center gap-3'}>
          {pullFeedback && (
            <span
              className={`customer-pull-feedback text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 shadow-sm ${
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

          {canUseMetaActions && (
            <>
              <button
                onClick={() => handlePullData()}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setIsPullDateModalOpen(true)
                }}
                disabled={isPulling}
                className="customer-pull-button flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50 select-none"
                title="Sol Tık: Sunucudaki son Meta kaydından itibaren al • Sağ Tık: Tarih aralığı seç"
              >
                <DownloadCloud className={`w-3.5 h-3.5 text-[#b99881] ${isPulling ? 'animate-bounce text-amber-400' : ''}`} />
                <span>{isPulling ? 'Veriler Alınıyor...' : 'Verileri Al'}</span>
              </button>
              {isMarketingView && <MetaSendButton />}

              {callCenterUsers.length > 0 && (
                <button
                  onClick={handleManualAutoAssign}
                  className="customer-distribute-button flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3d3733] border border-[#4a443f] text-xs font-semibold text-[#d6beae] hover:text-white cursor-pointer transition-colors shadow-sm"
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
              className="customer-add-button rounded-full px-4 text-xs font-semibold"
            >
              Yeni Müşteri Ekle
            </GlassButton>
          )}
        </div>
      </div>

      {!isMarketingView&&preferences.state.error&&<p role="alert" className="text-xs mb-2">{preferences.state.error} {preferences.state.conflict?<><button onClick={()=>void preferences.resolve(false)}>Sunucudakini kullan</button> · <button onClick={()=>void preferences.resolve(true)}>Benim düzenlememi kullan</button></>:<button onClick={()=>void preferences.retry()}>Tekrar dene</button>}</p>}
      {/* Tabs & Search Bar (Katmansız, Pill Shape) */}
      <div className="relative z-30 flex items-center justify-between gap-3 min-w-0">
        {isMarketingView ? (
          /* PAZARLAMA SEKMELERİ: En solda Tümü (sadece ikon olarak), sonra Meta ve ikonu, Google ve ikonu, sonra Web Sitesi ve Demirtürk ikonu */
          <OverflowTabs
            activeId={filterStage}
            onSelect={(id) => setFilterStage(id as any)}
            tabs={[
              {
                id: 'ALL',
                iconOnly: true,
                icon: <Layers className="w-4 h-4 shrink-0" />,
                title: `Tümü (${dateFilteredLeads.length})`,
                dropdownLabel: `Tümü (${dateFilteredLeads.length})`,
              },
              {
                id: 'CHANNEL_META',
                label: `Meta (${metaChannelCount})`,
                icon: (
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
                ),
              },
              {
                id: 'CHANNEL_GOOGLE',
                label: `Google (${googleChannelCount})`,
                icon: (
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
                  </svg>
                ),
              },
              {
                id: 'CHANNEL_WEB',
                label: `Web Sitesi (${webChannelCount})`,
                icon: <BookLogo animated={false} className="w-4 h-4 shrink-0" />,
              },
            ]}
          />
        ) : (
          <OverflowTabs
            className="customer-stage-tabs"
            activeId={filterStage}
            onSelect={(id) => setFilterStage(id as any)}
            tabs={[
              { id: 'NEW', label: `İlk temas (${firstContactCount})` },
              { id: 'CONTACTED', label: `İletişim (${contactedCount})` },
              {
                id: 'CALL_AGAIN',
                label: `Tekrar Ara (${callAgainCount})`,
                title: 'Tekrar ara ve Ulaşılamadı bilgisi seçilen müşteriler (Saatlik hatırlatma aktif)',
              },
              { id: 'QUALIFIED', label: `Nitelikli (${qualifiedCount})` },
              { id: 'OFFER', label: `Teklif (${offerCount})` },
              { id: 'CONVERTED', label: `Dönüşüm (${convertedCount})` },
              {
                id: 'OTHER',
                label: `Diğer (${otherCount})`,
                title: 'Potansiyel olmayan (Potansiyel Değil / Satın alma niyeti yok) kayıtlar',
              },
              { id: 'ALL', label: `Tümü (${dateFilteredLeads.length})` },
              ...customTabs.map((ct) => ({
                id: ct.id,
                label: ct.name,
                onRemove: (e: React.MouseEvent) => handleDeleteCustomTab(ct.id, e),
              })),
            ]}
            trailingElement={
              <button
                disabled={!preferences.state.ready} onClick={() => setIsAddTabModalOpen(true)}
                className="card-action-btn flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#34302d] text-[#b99881] hover:text-white hover:bg-[#3d3733] border border-[#4a443f] text-xs font-bold cursor-pointer transition-colors shrink-0"
                title="Yeni Özel Sekme Ekle"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="btn-label">Sekme Ekle</span>
              </button>
            }
          />
        )}

        {/* Sağ: Arama ve Tarih Seçimi */}
        <div className="flex items-center gap-2 shrink-0">
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
            <CustomSelect
              triggerLabel="Sırala"
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC')
              }
              className="pl-8 pr-7 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs font-semibold text-white focus:outline-none focus:border-[#b99881] cursor-pointer transition-colors"
              title="Müşteri sıralama ölçütü"
            >
              <option value="NEWEST">Yeniden eskiye</option>
              <option value="OLDEST">Eskiden yeniye</option>
              <option value="NAME_ASC">İsim (A - Z)</option>
              <option value="NAME_DESC">İsim (Z - A)</option>
            </CustomSelect>
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
      {(selectionMode || selectedIds.size > 0) && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--accent-color)]/40 bg-[var(--card-surface)] px-4 py-3 text-xs" role="status">
        <span className="font-semibold">{selectedIds.size} müşteri seçildi</span>
        <button type="button" onClick={() => { setSelectedIds(new Set()); setSelectionMode(false) }} className="text-[#a69f99] hover:underline">Vazgeç</button>
        {permissionService.canDeleteCustomer(currentUser || null) && <button type="button" disabled={selectedIds.size === 0 || selectedIds.size > 100} onClick={() => { setDeleteTargets([...selectedIds]); setDeleteError('') }}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-rose-400 border border-rose-400/30 disabled:opacity-50"><Trash2 size={13} />Seçilenleri sil</button>}
        {selectedIds.size > 100 && <span>Tek seferde en fazla 100 müşteri taşıyabilirsiniz.</span>}
      </div>}
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
                  <table className="customer-records-table w-full table-fixed text-xs text-left">
                    <colgroup>{[84,168,184,138,158,158,undefined,72].map((w,i)=><col key={i} style={w?{width:w}:undefined}/>)}</colgroup>
                    {segIdx === 0 && (
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-[#4a443f]/60 text-[#8c857f] text-[11px]">
                          {/* 1. Kolon: Tarih */}
                          <th className="py-3 px-3">
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
                          <th className="py-3 px-3">
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
                          <th className="py-3 px-3">İletişim</th>
                          {/* 4. Kolon: Atanan Danışman */}
                          <th className="py-3 px-3">Atanan Danışman</th>
                          {/* 5. Kolon: Bilgi */}
                          <th className="py-3 px-3">Bilgi</th>
                          {/* 6. Kolon: Aşama */}
                          <th className="py-3 px-3">Aşama</th>
                          {/* 7. Kolon: Açıklama */}
                          <th className="py-3 px-3">Açıklama</th>
                          {/* 8. Kolon: İşlemler */}
                          <th className="py-3 px-3">İşlemler</th>
                        </tr>
                      </thead>
                    )}
                    <tbody className="text-[#f3efe9]">
                      {segment.leads.map((lead) => {
                        const inquiryCount = lead.inquiries?.length || 1

                        return (
                          <tr
                            key={lead.id}
                            aria-selected={selectedIds.has(lead.id)}
                            onClickCapture={event => {
                              if (!selectionMode && !event.ctrlKey && !event.metaKey) return
                              event.preventDefault(); event.stopPropagation(); toggleSelected(lead.id)
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              setRowContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                lead,
                              })
                            }}
                            className="customer-table-row transition-colors border-b border-[#4a443f]/60 last:border-b-0"
                            style={selectedIds.has(lead.id) ? { background: 'color-mix(in srgb, var(--accent-color) 13%, transparent)', boxShadow: 'inset 3px 0 var(--accent-color)' } : undefined}
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
                                <LeadChannelIcon label={getLeadChannelLabel(lead)} />
                              </div>
                            </td>

                            {/* 3. Kolon: İletişim & WhatsApp İkonu */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs text-[#f3efe9] select-all tracking-wide">
                                  {formatPhoneDisplay(lead.phone)}
                                </span>
                                {lead.phone && <a className="lead-phone-link" href={`tel:${lead.phone}`} aria-label="Telefonla ara"><Phone size={14}/></a>}
                                {lead.phone ? (
                                  <a
                                    href={generateWhatsAppUrl(lead.whatsappPhone || lead.phone, lead.fullName)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center shrink-0"
                                    title="WhatsApp Mesajı Gönder"
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
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
                                  title={representativeView ? 'Müşteriyi devret' : 'Danışmanı Değiştir'}
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
                              {representativeView && lead.assignedToUserId === currentUser?.id && <button type="button"
                                className="mt-1 text-[10px] text-[var(--accent-color)] hover:underline" onClick={() => handleOpenConsultantChange(lead)}>Devret</button>}
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
                                  className="group flex items-center gap-2 pl-1 cursor-pointer max-w-full min-w-0"
                                  title="Açıklamayı düzenlemek için tıklayın"
                                >
                                  <span className="text-xs text-[#f3efe9] group-hover:text-[#b99881] customer-note-lines transition-colors select-text">
                                    {formatSentenceNote(lead.notes)}
                                  </span>
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
                                {permissionService.canHandOverToSales(currentUser ?? null) && (
                                  <button type="button" aria-label={isLeadHandedOverToSales(lead)?'Satışa Devredildi':'Satışa Devret'} className="lead-handover" onClick={()=>handleOpenAssign(lead)}>
                                    {isLeadHandedOverToSales(lead)?<UserCheck size={14}/>:<><Users size={12}/><ArrowRight size={9} style={{marginLeft:-1}}/></>}
                                  </button>
                                )}
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
              top: `${Math.max(8, Math.min(rowContextMenu.y, window.innerHeight - 322))}px`,
              left: `${Math.max(8, Math.min(rowContextMenu.x, window.innerWidth - 220))}px`,
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="dropdown-panel context-menu flex w-[205px] max-w-[calc(100vw-16px)] flex-col gap-1.5 rounded-[22px] p-2"
          >
            <div className="truncate border-b border-[var(--glass-border)] px-3 py-1 text-[10px] font-semibold opacity-75">
              {rowContextMenu.lead.fullName}
            </div>
            <button type="button" onClick={() => {
              setSelectionMode(true); setSelectedIds(new Set([rowContextMenu.lead.id])); setRowContextMenu(null)
            }} className={rowMenuItemClass}>
              <Check size={13} />Seç
            </button>
            {currentUser?.role==='ADMIN'&&<button type="button" className={rowMenuItemClass} onClick={()=>{setSelectedInquiryHistoryLead(rowContextMenu.lead);setRowContextMenu(null)}}><Layers size={13}/>Başvuru geçmişi</button>}
            {!isMarketingView&&<div className="relative"><button type="button" className={rowMenuItemClass+' w-full'} aria-expanded={!!moveMenu} disabled={!preferences.state.ready} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMoveMenu(moveMenu?null:{x:Math.max(6,Math.min(innerWidth-174,r.right+174<=innerWidth?r.right+4:r.left-172)),y:Math.max(6,Math.min(innerHeight-152,r.top))})}}><FolderPlus size={13}/>Taşı <ArrowRight size={12}/></button>
              {moveMenu&&createPortal(<div onClick={e=>e.stopPropagation()} role="menu" aria-label="Manuel sekmeler" className="lead-move-menu dropdown-panel" style={{position:'fixed',zIndex:100001,left:moveMenu.x,top:moveMenu.y,width:166}}>
                {customTabs.map(tab=><button type="button" role="menuitem" className={rowMenuItemClass} key={tab.id} onClick={()=>moveToTab(tab.id,rowContextMenu.lead.id)}>{tab.name}</button>)}
              </div>,document.body)}</div>}
            {permissionService.canDeleteCustomer(currentUser || null) && <button type="button"
              onClick={() => {
                const ids = selectedIds.has(rowContextMenu.lead.id) ? [...selectedIds] : [rowContextMenu.lead.id]
                setDeleteTargets(ids); setDeleteError(''); setRowContextMenu(null)
              }} className={`${rowMenuItemClass} text-rose-400`}>
              <Trash2 size={13} />Çöp kutusuna taşı
            </button>}
            {permissionService.canHandOverToSales(currentUser ?? null) && (
              isLeadHandedOverToSales(rowContextMenu.lead) ? (
                <button
                  type="button"
                  onClick={() => {
                    handleRevokeSalesHandover(rowContextMenu.lead)
                    setRowContextMenu(null)
                  }}
                  className={`${rowMenuItemClass} text-rose-400`}
                >
                  <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Satıştan Geri Çek</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser) {
                      leadStore.assignToSales(rowContextMenu.lead.id, null, currentUser)
                    }
                    setRowContextMenu(null)
                  }}
                  className={`${rowMenuItemClass} text-emerald-400`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Satışa Devret</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => handleToggleMilestone(rowContextMenu.lead.id)}
              className={rowMenuItemClass}
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
          {assignmentStart && <p className="rounded-xl border border-[var(--glass-border)] p-3 text-xs leading-relaxed text-[var(--tertiary-white)]">
            Otomatik temsilci dağıtımı: {assignmentStart} ve sonrası. Daha eski başvurular da kaydedilir; temsilciye otomatik atanmaz.
          </p>}

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
                value="Sunucuda yönetilir" readOnly disabled
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
            <div className="grid grid-cols-3 gap-2">
              <button type="button" aria-pressed={newTabCriteriaType==='MANUAL'} className="tab-pill-btn" onClick={()=>setNewTabCriteriaType('MANUAL')}>Manuel</button>
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

          {newTabCriteriaType === 'MANUAL' ? null : newTabCriteriaType === 'STAGE' ? (
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
      <GlassModal isOpen={deleteTargets.length > 0} onClose={() => { if (!deleting) setDeleteTargets([]) }} title="Müşterileri çöp kutusuna taşı" maxWidth="sm">
        <p className="text-sm">{deleteTargets.length} müşteri çöp kutusuna taşınacak. Daha sonra geri yükleyebilirsiniz.</p>
        {deleteError && <p role="alert" className="mt-3 text-xs text-rose-400">{deleteError}</p>}
        <div className="mt-5 flex justify-end gap-2"><GlassButton variant="subtle" size="sm" disabled={deleting} onClick={() => setDeleteTargets([])}>Vazgeç</GlassButton>
          <GlassButton variant="danger" size="sm" disabled={deleting || deleteTargets.length > 100} onClick={() => void confirmDelete()}>{deleting ? 'Taşınıyor…' : 'Çöp kutusuna taşı'}</GlassButton></div>
      </GlassModal>
      <GlassModal
        isOpen={selectedLeadForConsultantChange !== null}
        onClose={() => { if (!transferring) setSelectedLeadForConsultantChange(null) }}
        title={`${representativeView ? 'Müşteriyi Devret' : 'Danışman Ata / Değiştir'} - ${selectedLeadForConsultantChange?.fullName}`}
      >
        <form onSubmit={handleExecuteConsultantChange} className="space-y-4">
          {consultantChangeError && <p role="alert" className="text-sm text-rose-400">{consultantChangeError}</p>}
          <div>
            <GlassSelect
              label={representativeView ? 'Devredilecek temsilci' : 'Atanacak danışman'}
              value={selectedConsultantUserId}
              onChange={setSelectedConsultantUserId}
              placeholder="Danışman seçin..."
              options={allUsers.filter(u => !representativeView || (u.department === 'Müşteri İlişkileri' && u.role !== 'ADMIN' && u.id !== currentUser?.id)).map((u) => ({
                value: u.id,
                label: u.fullName,
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
            <GlassButton type="submit" variant="gold" size="sm" disabled={transferring || !selectedConsultantUserId} className="rounded-full px-5 font-bold">
              {transferring ? 'Kaydediliyor…' : representativeView ? 'Devret' : 'Danışmanı Kaydet'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* SATIŞA İLET MODALI */}
      <GlassModal
        isOpen={selectedLeadForAssign !== null}
        onClose={() => setSelectedLeadForAssign(null)}
        title={`Satışa Devret — ${selectedLeadForAssign?.fullName}`}
      >
        <form onSubmit={handleExecuteAssign} className="space-y-4">
          <p className="text-xs text-[#a69f99]">
            Müşteri İlişkileri, Pazarlama veya Yönetim onayınızla bu kayıt manuel olarak Satış departmanına devredilir.
          </p>

          <div>
            <GlassSelect
              label="Satış ekibi veya danışmanı"
              value={selectedSalesUserId}
              onChange={setSelectedSalesUserId}
              placeholder="Satış birimi veya temsilcisi seçin..."
              options={[
                { value: 'ALL_SALES', label: 'Tüm Satış Ekibi (Genel Satış Havuzu)' },
                ...salesUsers.map((u) => ({
                  value: u.id,
                  label: currentUser?.role === 'ADMIN' ? `${u.fullName} (${u.department} - ${u.role})` : `${u.fullName} (${visibleDepartment(u, currentUser)})`,
                })),
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Devir notu (isteğe bağlı)
            </label>
            <textarea
              rows={3}
              placeholder="Müşterinin ilgilendiği proje, bütçesi, randevu saati tercihi vb."
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 pb-1 flex items-center justify-between gap-2">
            {selectedLeadForAssign && isLeadHandedOverToSales(selectedLeadForAssign) ? (
              <button
                type="button"
                onClick={() => handleRevokeSalesHandover(selectedLeadForAssign)}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-400 cursor-pointer transition-colors"
              >
                Satıştan Geri Çek
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLeadForAssign(null)}
                className="px-4 py-2 rounded-full text-xs glass-button-subtle border border-[#4a443f] hover:border-[#b99881] text-[#a69f99] hover:text-white cursor-pointer transition-colors"
              >
                Vazgeç
              </button>
              <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
                {selectedLeadForAssign && isLeadHandedOverToSales(selectedLeadForAssign)
                  ? 'Satış Devrini Güncelle'
                  : 'Satışa Devret'}
              </GlassButton>
            </div>
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

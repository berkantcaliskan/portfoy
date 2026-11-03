import React, { useState, useEffect, useMemo } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Globe,
  Search,
  ExternalLink,
  Calendar,
  Sparkles,
  Home,
  Tag,
  ArrowRight,
  RefreshCw,
  X,
  Layers,
  ClipboardList,
  Trash2,
  Send,
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { OverflowTabs } from '@/components/ui/OverflowTabs'
import {
  requestStore,
  CustomerRequest,
  RequestPriority,
  RequestStatus,
} from '@/services/requestStore'
import { leadStore } from '@/services/leadStore'
import { userStore, AppUser } from '@/services/userStore'
import { permissionService } from '@/services/permissionService'
import { Lead, isLeadHandedOverToSales } from '@/types/lead'
import { formatPhoneDisplay } from '@/utils/formatters'

interface RequestsViewProps {
  currentUser?: AppUser | null
  leads?: Lead[]
  onSelectLead?: (lead: Lead) => void
}

export interface UnifiedRequestItem {
  id: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  subject: string
  category: string
  priority: RequestPriority
  status: RequestStatus
  assignedToUserName: string
  notes: string
  sourceType: 'WEBSITE' | 'META_ADS' | 'MANUAL'
  formName?: string
  preferredHousingType?: string
  budget?: number
  preferredDate?: string
  createdAt: string
  updatedAt: string
  leadId?: string
  lead?: Lead
  isFromRequestStore: boolean
  rawRequest?: CustomerRequest
}

// Clean phone for WhatsApp & Tel
function cleanPhoneForLink(phone?: string | null): string {
  if (!phone) return ''
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = '9' + digits
  else if (digits.length === 10) digits = '90' + digits
  return digits
}

function formatDate(isoString: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  currentUser: propUser,
  onSelectLead,
}) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(
    propUser || userStore.getCurrentUser()
  )
  const [requests, setRequests] = useState<CustomerRequest[]>(() => requestStore.getAll())
  const [allLeads, setAllLeads] = useState<Lead[]>(() => leadStore.getAllRaw())

  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Form states for manual request creation
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<CustomerRequest['category']>('Proje & Kat Planı')
  const [priority, setPriority] = useState<RequestPriority>('Orta')
  const [notes, setNotes] = useState('')

  const isSalesDept = currentUser?.department === 'Satış'
  const canHandOverToSales = permissionService.canHandOverToSales(currentUser)

  // Sync prop updates
  useEffect(() => {
    if (propUser) setCurrentUser(propUser)
  }, [propUser])

  // Subscriptions to stores
  useEffect(() => {
    const unsubReq = requestStore.subscribe(() => {
      setRequests(requestStore.getAll())
    })
    const unsubLead = leadStore.subscribe(() => {
      setAllLeads(leadStore.getAllRaw())
    })
    const unsubUser = userStore.subscribe(() => {
      if (!propUser) {
        setCurrentUser(userStore.getCurrentUser())
      }
    })
    return () => {
      unsubReq()
      unsubLead()
      unsubUser()
    }
  }, [propUser])

  // Refresh live from Supabase on mount
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        leadStore.refreshFromSupabase(),
        requestStore.refreshFromSupabase(),
      ])
      setAllLeads(leadStore.getAllRaw())
      setRequests(requestStore.getAll())
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  useEffect(() => {
    handleRefresh()
  }, [])

  // Build unified list of requests
  // Satış departmanında web sitesinden gelen hiçbir müşteri verisi (Müşteri İlişkileri / Pazarlama / Yönetim "Satışa İlet" demedikçe) KESİNLİKLE gösterilmez!
  const unifiedItems: UnifiedRequestItem[] = useMemo(() => {
    const items: UnifiedRequestItem[] = []
    const seenItemIds = new Set<string>()

    // 1. Process items from requestStore (manual employee requests + website webhook requests)
    for (const req of requests) {
      if (seenItemIds.has(req.id)) continue

      // Exclude any request that was accidentally auto-created from a Meta form lead
      const isAccidentalMetaForm =
        /^Başvuru Formu:/i.test(req.subject) ||
        req.subject === 'Müşteri Kaydı' ||
        req.subject.toLowerCase().includes('meta lead')
      if (isAccidentalMetaForm) continue

      const cleanPhone = cleanPhoneForLink(req.customerPhone)
      const isWeb =
        req.id.startsWith('req-web-') ||
        req.subject.toLowerCase().includes('web sitesi') ||
        req.subject.toLowerCase().includes('web başvurusu') ||
        req.assignedToUserName?.toLowerCase().includes('web')

      // Find matching lead in CRM if available
      const matchedLead = allLeads.find((l) => {
        const lClean = cleanPhoneForLink(l.phone)
        return (
          lClean &&
          cleanPhone &&
          (lClean === cleanPhone || (cleanPhone.length > 7 && lClean.endsWith(cleanPhone.slice(-7))))
        )
      })

      // Satış departmanı kuralı: Müşteri İlişkileri / Pazarlama / Yönetim "Satışa İlet" demedikçe hiçbir kanal (Websitesi, Meta, Manuel vb.) Satışta görünmez; devredilirse görünür!
      if (isSalesDept && (!matchedLead || !isLeadHandedOverToSales(matchedLead))) {
        continue
      }

      seenItemIds.add(req.id)

      if (matchedLead) {
        seenItemIds.add(`lead-${matchedLead.id}`)
      }

      items.push({
        id: req.id,
        customerName: req.customerName,
        customerPhone: req.customerPhone,
        customerEmail: matchedLead?.email,
        subject: req.subject,
        category: req.category,
        priority: req.priority,
        status: req.status,
        assignedToUserName: req.assignedToUserName || 'Çalışan',
        notes: req.notes,
        sourceType: isWeb ? 'WEBSITE' : 'MANUAL',
        formName: isWeb
          ? req.subject.replace(/^Web Sitesi:\s*|^Web Başvurusu:\s*/i, '').trim()
          : undefined,
        preferredHousingType: matchedLead?.preferredHousingType,
        budget: matchedLead?.budget,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        leadId: matchedLead?.id,
        lead: matchedLead,
        isFromRequestStore: true,
        rawRequest: req,
      })
    }

    // 2. Process website submissions from leads (Satış departmanında yalnızca "Satışa İlet" ile devredilmiş olanlar görünür!)
    for (const lead of allLeads) {
      if (isSalesDept && !isLeadHandedOverToSales(lead)) {
        continue
      }

      const isMetaFormLead =
        lead.source === 'META_ADS' ||
        Boolean(lead.metaLeadId) ||
        lead.channel?.toLowerCase().includes('meta') ||
        lead.channel?.toLowerCase().includes('facebook') ||
        lead.channel?.toLowerCase().includes('instagram')

      const isLeadWebsite =
        !isMetaFormLead &&
        (lead.source === 'WEBSITE' ||
          lead.id.startsWith('lead-web-') ||
          lead.channel?.toLowerCase().includes('web') ||
          lead.tags?.some((t) => t.toLowerCase().includes('web')))

      // Check inquiries inside this lead that specifically came from the website
      const webInquiries = (lead.inquiries || []).filter(
        (inq) =>
          inq.source === 'WEBSITE' ||
          inq.channel?.toLowerCase().includes('web') ||
          inq.campaignName?.toLowerCase().includes('web')
      )

      if (webInquiries.length > 0) {
        for (const inq of webInquiries) {
          const inqId = inq.id || `inq-${lead.id}-${inq.createdAt}`
          if (seenItemIds.has(inqId)) continue
          seenItemIds.add(inqId)

          const isTour =
            inq.formName?.toLowerCase().includes('tur') ||
            inq.formName?.toLowerCase().includes('tanıtım')

          let mappedStatus: RequestStatus = 'Açık'
          if (lead.stage === 'WON' || lead.stage === 'LOST') {
            mappedStatus = 'Çözüldü'
          } else if (
            ['CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'PRESENTATION', 'OFFER'].includes(lead.stage)
          ) {
            mappedStatus = 'İşlemde'
          }

          items.push({
            id: inqId,
            customerName: lead.fullName,
            customerPhone: lead.phone,
            customerEmail: lead.email,
            subject: inq.formName
              ? `Web Sitesi: ${inq.formName}`
              : `Web Sitesi Başvurusu: ${lead.formName || 'İletişim'}`,
            category: isTour ? 'Satış Öncesi Bilgi' : 'Genel Talep',
            priority: isTour ? 'Yüksek' : 'Orta',
            status: mappedStatus,
            assignedToUserName: lead.assignedToUserName || lead.owner || 'Web Sitesi',
            notes: inq.notes || lead.notes || '',
            sourceType: 'WEBSITE',
            formName: inq.formName || lead.formName || 'Web Başvurusu',
            preferredHousingType: inq.preferredHousingType || lead.preferredHousingType,
            budget: inq.budget || lead.budget,
            createdAt: inq.createdAt || lead.createdAt,
            updatedAt: inq.createdAt || lead.updatedAt,
            leadId: lead.id,
            lead,
            isFromRequestStore: false,
          })
        }
      }

      // Only add lead itself if it is a website submission without inquiries
      if (webInquiries.length > 0 || !isLeadWebsite) continue

      const leadKey = `lead-${lead.id}`
      if (!seenItemIds.has(leadKey)) {
        seenItemIds.add(leadKey)

        const isTour =
          lead.formName?.toLowerCase().includes('tur') ||
          lead.formName?.toLowerCase().includes('tanıtım')

        let mappedStatus: RequestStatus = 'Açık'
        if (lead.stage === 'WON' || lead.stage === 'LOST') {
          mappedStatus = 'Çözüldü'
        } else if (
          ['CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'PRESENTATION', 'OFFER'].includes(lead.stage)
        ) {
          mappedStatus = 'İşlemde'
        }

        items.push({
          id: leadKey,
          customerName: lead.fullName,
          customerPhone: lead.phone,
          customerEmail: lead.email,
          subject: lead.formName ? `Web Sitesi: ${lead.formName}` : 'Web Sitesi İletişim / Başvuru',
          category: isTour ? 'Satış Öncesi Bilgi' : 'Genel Talep',
          priority: isTour ? 'Yüksek' : 'Orta',
          status: mappedStatus,
          assignedToUserName: lead.assignedToUserName || lead.owner || 'Web Sitesi',
          notes: lead.notes || '',
          sourceType: 'WEBSITE',
          formName: lead.formName || 'Web Başvurusu',
          preferredHousingType: lead.preferredHousingType,
          budget: lead.budget,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          leadId: lead.id,
          lead,
          isFromRequestStore: false,
        })
      }
    }

    // Sort newest first
    return items.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0
      const timeB = new Date(b.createdAt).getTime() || 0
      return timeB - timeA
    })
  }, [requests, allLeads, isSalesDept])

  // Top KPI Counts
  const webItems = useMemo(() => unifiedItems.filter((i) => i.sourceType === 'WEBSITE'), [unifiedItems])
  const manualItems = useMemo(() => unifiedItems.filter((i) => i.sourceType === 'MANUAL'), [unifiedItems])
  const webCount = webItems.length

  useEffect(() => {
    if (isSalesDept && filterStatus === 'WEBSITE' && webCount === 0) {
      setFilterStatus('ALL')
    }
  }, [isSalesDept, filterStatus, webCount])
  const manualCount = manualItems.length
  const openCount = unifiedItems.filter((i) => i.status === 'Açık').length
  const inProgressCount = unifiedItems.filter((i) => i.status === 'İşlemde').length
  const resolvedCount = unifiedItems.filter((i) => i.status === 'Çözüldü').length
  const totalCount = unifiedItems.length

  // Filtered items
  const filtered = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (filterStatus === 'WEBSITE') {
        if (item.sourceType !== 'WEBSITE') return false
      } else if (filterStatus === 'MANUAL') {
        if (item.sourceType !== 'MANUAL') return false
      } else if (filterStatus !== 'ALL') {
        if (item.status !== filterStatus) return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const match =
          item.customerName.toLowerCase().includes(q) ||
          item.customerPhone.includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          (item.formName && item.formName.toLowerCase().includes(q)) ||
          item.notes.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.assignedToUserName.toLowerCase().includes(q) ||
          (item.preferredHousingType && item.preferredHousingType.toLowerCase().includes(q))
        if (!match) return false
      }

      return true
    })
  }, [unifiedItems, filterStatus, searchQuery])

  // Handle Create Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || !subject.trim()) return

    requestStore.addRequest({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      subject: subject.trim(),
      category,
      priority,
      status: 'Açık',
      assignedToUserName: currentUser?.fullName || 'Müşteri Temsilcisi',
      notes: notes.trim(),
    })

    setIsAddModalOpen(false)
    setCustomerName('')
    setCustomerPhone('')
    setSubject('')
    setNotes('')
  }

  // Handle Status Change
  const handleStatusChange = (item: UnifiedRequestItem, newStatus: RequestStatus) => {
    if (item.isFromRequestStore && item.rawRequest) {
      requestStore.updateStatus(item.id, newStatus)
    } else {
      // Persist to requestStore so it gets a synchronized record
      requestStore.addRequest({
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        subject: item.subject,
        category: (item.category as any) || 'Genel Talep',
        priority: item.priority,
        status: newStatus,
        assignedToUserName: currentUser?.fullName || item.assignedToUserName || 'Temsilci',
        notes: item.notes,
      })
    }

    // If associated with a Lead, also advance or sync lead stage
    if (item.lead) {
      if (newStatus === 'İşlemde' && item.lead.stage === 'NEW') {
        leadStore.updateStage(item.lead.id, 'CONTACTED', currentUser)
      } else if (newStatus === 'Çözüldü' && (item.lead.stage === 'NEW' || item.lead.stage === 'CONTACTED')) {
        leadStore.updateStage(item.lead.id, 'QUALIFIED', currentUser)
      }
    }
  }

  // Handle Manual Handover to Sales (Müşteri İlişkileri, Pazarlama veya Yönetim)
  const handleToggleSalesHandover = (item: UnifiedRequestItem) => {
    if (!canHandOverToSales || !currentUser) return
    if (item.lead) {
      if (isLeadHandedOverToSales(item.lead)) {
        leadStore.revokeSalesHandover(item.lead.id, currentUser)
      } else {
        leadStore.assignToSales(item.lead.id, null, currentUser)
      }
    } else {
      const created = leadStore.add({
        fullName: item.customerName,
        phone: item.customerPhone || '',
        email: item.customerEmail,
        source: item.sourceType === 'WEBSITE' ? 'WEBSITE' : 'DIRECT',
        channel: item.sourceType === 'WEBSITE' ? 'Web Sitesi' : 'Manuel Talep',
        formName: item.formName || item.subject,
        stage: 'NEW',
        isQualified: false,
        owner: currentUser.fullName,
        tags: item.sourceType === 'WEBSITE' ? ['Web Sitesi'] : ['Manuel Talep'],
        preferredHousingType: item.preferredHousingType,
        budget: item.budget,
        notes: item.notes,
      })
      leadStore.assignToSales(created.id, null, currentUser)
    }
    setAllLeads(leadStore.getAllRaw())
  }

  // Handle Delete Request / Web Submission
  const handleDeleteItem = (item: UnifiedRequestItem) => {
    if (item.isFromRequestStore) {
      requestStore.deleteRequest(item.id)
    }
    if (item.leadId) {
      leadStore.delete(item.leadId)
    }
    setRequests(requestStore.getAll())
    setAllLeads(leadStore.getAllRaw())
  }

  const filterTabs = useMemo(() => {
    const base = [{ id: 'ALL', label: `Tümü (${totalCount})` }]
    if (!isSalesDept || webCount > 0) {
      base.push({ id: 'WEBSITE', label: `🌐 İnternet Sitesi Başvuruları (${webCount})` })
    }
    base.push(
      { id: 'MANUAL', label: `✍️ Manuel Müşteri İstekleri (${manualCount})` },
      { id: 'Açık', label: `Açık (${openCount})` },
      { id: 'İşlemde', label: `İşlemde (${inProgressCount})` },
      { id: 'Çözüldü', label: `Çözüldü (${resolvedCount})` }
    )
    return base
  }, [isSalesDept, totalCount, webCount, manualCount, openCount, inProgressCount, resolvedCount])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-[#dfb76c]" />
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide">
                Talepler
              </h2>
            </div>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            {isSalesDept
              ? 'Müşteri İlişkileri, Pazarlama veya Yönetim tarafından Satışa devredilen müşteri talepleri.'
              : 'İnternet sitesi başvuruları ve çalışanlar tarafından manuel girilen müşteri istekleri.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 rounded-full bg-[#34302d] hover:bg-[#3f3b37] border border-[#4a443f] text-[#a69f99] hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Buluttan Canlı Verileri Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#b99881] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>

          <GlassButton
            variant="gold"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-full px-5 text-xs font-semibold shadow-sm"
          >
            Yeni Talep Kaydet
          </GlassButton>
        </div>
      </div>

      {/* KPI Stats Row - Rule: Second word is strictly lowercase */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 ${
          !isSalesDept || webCount > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        } gap-3`}
      >
        {(!isSalesDept || webCount > 0) && (
          <div className="responsive-kpi-card p-4 rounded-[18px] bg-[#282522] border border-[#b99881]/40 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="kpi-title text-[11px] text-[#dfb76c] font-medium uppercase tracking-wider" title="Web Başvuruları">
                Web Başvuruları
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
                <span className="text-2xl font-bold text-[#dfb76c] shrink-0">{webCount}</span>
                <span className="kpi-sub-label text-xs text-[#a69f99] font-medium">web başvurusu</span>
              </div>
            </div>
            <Globe className="w-5 h-5 text-[#dfb76c] opacity-80 shrink-0" />
          </div>
        )}

        <div className="responsive-kpi-card p-4 rounded-[18px] bg-[#282522] border border-rose-500/20 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="kpi-title text-[11px] text-rose-400/80 font-medium uppercase tracking-wider" title="Açık Talepler">
              Açık Talepler
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl font-bold text-rose-400 shrink-0">{openCount}</span>
              <span className="kpi-sub-label text-xs text-[#a69f99] font-medium">açık</span>
            </div>
          </div>
          <AlertCircle className="w-5 h-5 text-rose-400 opacity-80 shrink-0" />
        </div>

        <div className="responsive-kpi-card p-4 rounded-[18px] bg-[#282522] border border-amber-500/20 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="kpi-title text-[11px] text-amber-400/80 font-medium uppercase tracking-wider" title="İşlemde">
              İşlemde
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl font-bold text-amber-400 shrink-0">{inProgressCount}</span>
              <span className="kpi-sub-label text-xs text-[#a69f99] font-medium">işlemde</span>
            </div>
          </div>
          <RefreshCw className="w-5 h-5 text-amber-400 opacity-80 shrink-0" />
        </div>

        <div className="responsive-kpi-card p-4 rounded-[18px] bg-[#282522] border border-emerald-500/20 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="kpi-title text-[11px] text-emerald-400/80 font-medium uppercase tracking-wider" title="Çözüldü">
              Çözüldü
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl font-bold text-emerald-400 shrink-0">{resolvedCount}</span>
              <span className="kpi-sub-label text-xs text-[#a69f99] font-medium">çözüldü</span>
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80 shrink-0" />
        </div>

        <div className="responsive-kpi-card p-4 rounded-[18px] bg-[#282522] border border-[#4a443f] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="kpi-title text-[11px] text-[#8c857f] font-medium uppercase tracking-wider" title="Manuel Talepler">
              Manuel Talepler
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl font-bold text-white shrink-0">{manualCount}</span>
              <span className="kpi-sub-label text-xs text-[#a69f99] font-medium">müşteri isteği</span>
            </div>
          </div>
          <Layers className="w-5 h-5 text-[#a69f99] opacity-80 shrink-0" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        {/* Filter buttons */}
        <OverflowTabs
          prefixLabel="Filtre:"
          activeId={filterStatus}
          onSelect={(id) => setFilterStatus(id)}
          tabs={filterTabs}
        />

        {/* Search Input */}
        <div className="relative w-48 sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c857f]" />
          <input
            type="text"
            placeholder="Talep, isim veya telefon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-full bg-[#34302d] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-white rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Requests Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Talep kaydı bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1 max-w-sm mx-auto">
            Seçili filtreye veya arama kriterine uygun müşteri talebi bulunmamaktadır.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const cleanDigits = cleanPhoneForLink(item.customerPhone)
            const waText = encodeURIComponent(
              `Merhaba ${item.customerName} Bey/Hanım, Demirtürk İnşaat web sitemizden ilettiğiniz form talebiniz üzerine iletişime geçiyorum. Nasıl yardımcı olabilirim?`
            )
            const waUrl = cleanDigits ? `https://wa.me/${cleanDigits}?text=${waText}` : ''
            const isHandedOver = Boolean(item.lead && isLeadHandedOverToSales(item.lead))

            return (
              <div
                key={item.id}
                className="responsive-card p-5 rounded-[22px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                {/* Top Header */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      {item.sourceType === 'WEBSITE' ? (
                        <span
                          className="card-badge-pill px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b99881]/20 text-[#dfb76c] border border-[#b99881]/40"
                          title={item.formName || 'Web Başvurusu'}
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span>{item.formName || 'Web Başvurusu'}</span>
                        </span>
                      ) : item.sourceType === 'META_ADS' ? (
                        <span
                          className="card-badge-pill px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          title={item.formName || 'Meta Ads Formu'}
                        >
                          <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>{item.formName || 'Meta Ads Formu'}</span>
                        </span>
                      ) : (
                        <span
                          className="card-badge-pill px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34302d] text-[#a69f99] border border-[#4a443f]"
                          title={item.category}
                        >
                          <Tag className="w-3 h-3 text-[#8c857f] shrink-0" />
                          <span>{item.category}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          item.priority === 'Acil'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : item.priority === 'Yüksek'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-stone-500/20 text-stone-300 border border-stone-500/30'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <GlassBadge
                        size="sm"
                        variant={
                          item.status === 'Çözüldü'
                            ? 'success'
                            : item.status === 'İşlemde'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {item.status}
                      </GlassBadge>
                    </div>
                  </div>

                  {/* Subject */}
                  <h3 className="text-sm font-bold text-white mt-2.5 truncate" title={item.subject}>
                    {item.subject}
                  </h3>

                  {/* Customer Info */}
                  <div className="space-y-1.5 text-xs text-[#a69f99] mt-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 text-white font-medium min-w-0 overflow-hidden">
                        <User className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                        <span className="truncate">{item.customerName}</span>
                      </div>
                      {item.lead && onSelectLead && (
                        <button
                          onClick={() => onSelectLead(item.lead!)}
                          title="Müşteri Kartını Aç"
                          className="card-action-btn text-[11px] text-[#dfb76c] hover:underline flex items-center gap-1 cursor-pointer rounded-full px-2 py-0.5 shrink-0"
                        >
                          <span className="btn-label">Kartı Aç</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                      )}
                    </div>

                    {item.customerPhone && (
                      <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                        <Phone className="w-3.5 h-3.5 text-[#8c857f] shrink-0" />
                        <span className="truncate">{formatPhoneDisplay(item.customerPhone)}</span>
                      </div>
                    )}

                    {item.preferredHousingType && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#dfb76c]/90 min-w-0">
                        <Home className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                        <span className="truncate">Konut Talebi: {item.preferredHousingType}</span>
                      </div>
                    )}

                    {item.budget ? (
                      <div className="text-[11px] text-[#a69f99] pl-5 truncate">
                        Bütçe: {item.budget.toLocaleString('tr-TR')} ₺
                      </div>
                    ) : null}

                    {/* Customer Message / Notes */}
                    {item.notes && (
                      <p className="text-[11px] text-[#d6beae] mt-2 leading-relaxed italic line-clamp-2">
                        "{item.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="pt-2 space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#8c857f] min-w-0">
                    <span className="truncate shrink-0">{formatDate(item.createdAt)}</span>
                    <span className="truncate text-right">
                      {item.sourceType === 'MANUAL'
                        ? `Manuel Giren: ${item.assignedToUserName}`
                        : `Temsilci: ${item.assignedToUserName}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1 min-w-0">
                    {/* Direct Contact Buttons */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.customerPhone && (
                        <a
                          href={`tel:${cleanDigits}`}
                          className="card-action-btn px-3 py-1 rounded-full bg-[#34302d] hover:bg-[#3f3b37] border border-[#4a443f] text-[11px] text-white transition-all"
                          title="Hemen Ara"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#b99881] shrink-0" />
                          <span className="btn-label">Ara</span>
                        </a>
                      )}
                      {cleanDigits && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="card-action-btn px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] text-emerald-400 transition-all"
                          title="WhatsApp İle İletişim"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="btn-label">WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {/* Status Toggles & Handover */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {canHandOverToSales && (
                        <button
                          type="button"
                          onClick={() => handleToggleSalesHandover(item)}
                          title={
                            isHandedOver
                              ? 'Satıştan Geri Çek'
                              : 'Müşteri verisini Satış ekibine manuel devret'
                          }
                          className={`card-action-btn px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                            isHandedOver
                              ? 'bg-emerald-500/20 hover:bg-rose-500/20 border border-emerald-500/40 text-emerald-300 hover:text-rose-300'
                              : 'bg-[#b99881]/20 hover:bg-[#b99881]/35 border border-[#b99881]/50 text-[#dfb76c]'
                          }`}
                        >
                          <Send className="w-3 h-3 shrink-0" />
                          <span className="btn-label">{isHandedOver ? 'Satışta ✓' : 'Satışa İlet'}</span>
                        </button>
                      )}
                      {item.status !== 'İşlemde' && item.status !== 'Çözüldü' && (
                        <button
                          onClick={() => handleStatusChange(item, 'İşlemde')}
                          title="İşleme Al"
                          className="card-action-btn px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                          <span className="btn-label">İşleme Al</span>
                        </button>
                      )}
                      {item.status !== 'Çözüldü' && (
                        <button
                          onClick={() => handleStatusChange(item, 'Çözüldü')}
                          title="Çözüldü Olarak İşaretle"
                          className="card-action-btn px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="btn-label">Çözüldü</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[#34302d] hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer shrink-0"
                        title="Talebi / Başvuruyu Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* YENİ TALEP MODALI */}
      <GlassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Müşteri Destek / Bilgi Talebi"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Müşteri Adı Soyadı *
              </label>
              <input
                type="text"
                required
                placeholder="Örn: Ahmet Ulucak"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Telefon Numarası
              </label>
              <input
                type="text"
                placeholder="+90 542 000 00 00"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Talep Konusu *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Balkon cam kapama ve mimari izin süreci"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kategori
              </label>
              <CustomSelect
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Proje & Kat Planı">Proje & Kat Planı</option>
                <option value="Satış Öncesi Bilgi">Satış Öncesi Bilgi</option>
                <option value="Ödeme & Finansman">Ödeme & Finansman</option>
                <option value="Satış Sonrası Destek">Satış Sonrası Destek</option>
                <option value="Genel Talep">Genel Talep</option>
              </CustomSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Öncelik
              </label>
              <CustomSelect
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                className="w-full px-3.5 py-2 rounded-full bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Düşük">Düşük</option>
                <option value="Orta">Orta</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Acil">Acil</option>
              </CustomSelect>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
              Ayrıntılı Talep Notu
            </label>
            <textarea
              rows={3}
              placeholder="Müşterinin ilettiği özel detaylar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-full text-xs text-[#a69f99] hover:text-white cursor-pointer"
            >
              Vazgeç
            </button>
            <GlassButton type="submit" variant="gold" size="sm" className="rounded-full px-5 font-bold">
              Talebi Kaydet
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  )
}

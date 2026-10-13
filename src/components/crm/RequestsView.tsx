import React, { useState, useEffect, useMemo } from 'react'
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Globe,
  MessageSquare,
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
} from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassModal } from '@/components/ui/GlassModal'
import {
  requestStore,
  CustomerRequest,
  RequestPriority,
  RequestStatus,
} from '@/services/requestStore'
import { leadStore } from '@/services/leadStore'
import { userStore, AppUser } from '@/services/userStore'
import { Lead } from '@/types/lead'
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
  // Always use raw unfiltered leads from leadStore so department scopes never hide website submissions
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

  // Build unified list of requests (combining requestStore + website submissions + all leads)
  const unifiedItems: UnifiedRequestItem[] = useMemo(() => {
    const items: UnifiedRequestItem[] = []
    const seenItemIds = new Set<string>()

    // 1. Process items from requestStore (manual requests + edge function webhook requests)
    for (const req of requests) {
      if (seenItemIds.has(req.id)) continue
      seenItemIds.add(req.id)

      const cleanPhone = cleanPhoneForLink(req.customerPhone)
      const isWeb =
        req.id.startsWith('req-web-') ||
        req.subject.toLowerCase().includes('web') ||
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
        assignedToUserName: req.assignedToUserName,
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

    // 2. Process all leads from Supabase / leadStore (ensuring website leads and inquiries are prominent)
    for (const lead of allLeads) {
      const isLeadWebsite =
        lead.source === 'WEBSITE' ||
        lead.channel?.toLowerCase().includes('web') ||
        lead.tags?.some((t) => t.toLowerCase().includes('web'))

      // Also check inquiries inside this lead
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

        const sourceType = isLeadWebsite ? 'WEBSITE' : lead.source === 'META_ADS' ? 'META_ADS' : 'MANUAL'

        items.push({
          id: leadKey,
          customerName: lead.fullName,
          customerPhone: lead.phone,
          customerEmail: lead.email,
          subject: isLeadWebsite
            ? (lead.formName ? `Web Sitesi: ${lead.formName}` : 'Web Sitesi İletişim / Başvuru')
            : (lead.formName ? `Başvuru Formu: ${lead.formName}` : 'Müşteri Kaydı'),
          category: isTour ? 'Satış Öncesi Bilgi' : isLeadWebsite ? 'Genel Talep' : 'Proje & Kat Planı',
          priority: isTour ? 'Yüksek' : 'Orta',
          status: mappedStatus,
          assignedToUserName: lead.assignedToUserName || lead.owner || 'Demirtürk CRM',
          notes: lead.notes || (lead.metaAnswers && lead.metaAnswers.length > 0 ? lead.metaAnswers.map(m => `${m.question}: ${m.answer}`).join(' | ') : ''),
          sourceType,
          formName: lead.formName || (isLeadWebsite ? 'Web Formu' : 'Meta Formu'),
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
  }, [requests, allLeads])

  // Top KPI Counts
  const webItems = useMemo(() => unifiedItems.filter((i) => i.sourceType === 'WEBSITE'), [unifiedItems])
  const webCount = webItems.length
  const openCount = unifiedItems.filter((i) => i.status === 'Açık').length
  const inProgressCount = unifiedItems.filter((i) => i.status === 'İşlemde').length
  const resolvedCount = unifiedItems.filter((i) => i.status === 'Çözüldü').length
  const totalCount = unifiedItems.length

  // Filtered items
  const filtered = useMemo(() => {
    return unifiedItems.filter((item) => {
      // By default or when 'ALL' is selected: prioritize web entries and requests
      if (filterStatus === 'ALL') {
        // Show all items (web submissions and customer requests)
        return true
      }

      if (filterStatus === 'WEBSITE') {
        if (item.sourceType !== 'WEBSITE') return false
      } else if (filterStatus === 'META_ADS') {
        if (item.sourceType !== 'META_ADS') return false
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#b99881]/20 border border-[#b99881]/40 flex items-center justify-center text-[#dfb76c]">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide">
                Talepler
              </h2>
            </div>
          </div>
          <p className="text-xs text-[#a69f99] mt-1">
            Web sitesi form başvuruları (ücretsiz tanıtım turu, iletişim), müşteri bilgi ve destek talepleri.
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-[18px] bg-[#282522] border border-[#b99881]/40 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#dfb76c] font-medium uppercase tracking-wider">Web Girdileri</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#dfb76c]">{webCount}</span>
              <span className="text-xs text-[#a69f99] font-medium">web başvurusu</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#b99881]/20 border border-[#b99881]/40 flex items-center justify-center text-[#dfb76c]">
            <Globe className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-[18px] bg-[#282522] border border-rose-500/20 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-rose-400/80 font-medium uppercase tracking-wider">Açık Talepler</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-rose-400">{openCount}</span>
              <span className="text-xs text-[#a69f99] font-medium">açık</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-[18px] bg-[#282522] border border-amber-500/20 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-amber-400/80 font-medium uppercase tracking-wider">İşlemde</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-400">{inProgressCount}</span>
              <span className="text-xs text-[#a69f99] font-medium">işlemde</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-[18px] bg-[#282522] border border-emerald-500/20 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-400/80 font-medium uppercase tracking-wider">Çözüldü</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{resolvedCount}</span>
              <span className="text-xs text-[#a69f99] font-medium">çözüldü</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-[18px] bg-[#282522] border border-[#4a443f] flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#8c857f] font-medium uppercase tracking-wider">Tüm Havuz</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{totalCount}</span>
              <span className="text-xs text-[#a69f99] font-medium">toplam kayıt</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#34302d] border border-[#4a443f] flex items-center justify-center text-[#a69f99]">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[20px] bg-[#282522] border border-[#4a443f]">
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[#8c857f] mr-1">Filtre:</span>
          {[
            { id: 'ALL', label: 'Tümü' },
            { id: 'WEBSITE', label: `🌐 Web Başvuruları (${webCount})` },
            { id: 'Açık', label: `Açık (${openCount})` },
            { id: 'İşlemde', label: `İşlemde (${inProgressCount})` },
            { id: 'Çözüldü', label: `Çözüldü (${resolvedCount})` },
            { id: 'META_ADS', label: '📱 Meta Ads' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-[#b99881] text-[#282522] font-bold shadow-sm'
                  : 'bg-[#34302d] text-[#a69f99] hover:text-white border border-[#4a443f]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c857f]" />
          <input
            type="text"
            placeholder="Talep, isim veya telefon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-full bg-[#1e1c1a] border border-[#4a443f] text-xs text-white placeholder-[#8c857f] focus:outline-none focus:border-[#b99881]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c857f] hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Requests Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-[24px] bg-[#282522] border border-[#4a443f]">
          <AlertCircle className="w-10 h-10 text-[#8c857f] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-white">Talep kaydı bulunamadı</h3>
          <p className="text-xs text-[#8c857f] mt-1">
            Seçili filtreye veya arama kriterine uygun müşteri ya da web talebi bulunmamaktadır.
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

            return (
              <div
                key={item.id}
                className="p-5 rounded-[22px] bg-[#282522] border border-[#4a443f] hover:border-[#b99881]/70 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                {/* Top Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.sourceType === 'WEBSITE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b99881]/20 text-[#dfb76c] border border-[#b99881]/40">
                          <Globe className="w-3 h-3" />
                          {item.formName || 'Web Başvurusu'}
                        </span>
                      ) : item.sourceType === 'META_ADS' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          <Sparkles className="w-3 h-3 text-sky-400" />
                          {item.formName || 'Meta Ads Formu'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34302d] text-[#a69f99] border border-[#4a443f]">
                          <Tag className="w-3 h-3 text-[#8c857f]" />
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                  <h3 className="text-sm font-bold text-white mt-2.5 line-clamp-2">
                    {item.subject}
                  </h3>

                  {/* Customer Info */}
                  <div className="space-y-1.5 text-xs text-[#a69f99] mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <User className="w-3.5 h-3.5 text-[#b99881]" />
                        <span>{item.customerName}</span>
                      </div>
                      {item.lead && onSelectLead && (
                        <button
                          onClick={() => onSelectLead(item.lead!)}
                          className="text-[11px] text-[#dfb76c] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Kartı Aç <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {item.customerPhone && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-[#8c857f]" />
                        <span>{formatPhoneDisplay(item.customerPhone)}</span>
                      </div>
                    )}

                    {item.preferredHousingType && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#dfb76c]/90">
                        <Home className="w-3.5 h-3.5 text-[#b99881]" />
                        <span>Konut Talebi: {item.preferredHousingType}</span>
                      </div>
                    )}

                    {item.budget ? (
                      <div className="text-[11px] text-[#a69f99] pl-5">
                        Bütçe: {item.budget.toLocaleString('tr-TR')} ₺
                      </div>
                    ) : null}

                    {/* Customer Message / Notes */}
                    {item.notes && (
                      <div className="p-2.5 rounded-[12px] bg-[#1e1c1a] border border-[#4a443f]/60 text-[11px] text-[#d6beae] mt-2 leading-relaxed">
                        {item.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="pt-3 border-t border-[#4a443f]/60 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] text-[#8c857f]">
                    <span>{formatDate(item.createdAt)}</span>
                    <span>Temsilci: {item.assignedToUserName}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Direct Contact Buttons */}
                    <div className="flex items-center gap-1.5">
                      {item.customerPhone && (
                        <a
                          href={`tel:${cleanDigits}`}
                          className="px-2.5 py-1 rounded-[10px] bg-[#34302d] hover:bg-[#3f3b37] border border-[#4a443f] text-[11px] text-white flex items-center gap-1 transition-all"
                          title="Hemen Ara"
                        >
                          <Phone className="w-3 h-3 text-[#b99881]" />
                          <span>Ara</span>
                        </a>
                      )}
                      {cleanDigits && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] text-emerald-400 flex items-center gap-1 transition-all"
                          title="WhatsApp İle İletişim"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {/* Status Toggles */}
                    <div className="flex items-center gap-1.5">
                      {item.status !== 'İşlemde' && item.status !== 'Çözüldü' && (
                        <button
                          onClick={() => handleStatusChange(item, 'İşlemde')}
                          className="px-2.5 py-1 rounded-[10px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          İşleme Al
                        </button>
                      )}
                      {item.status !== 'Çözüldü' && (
                        <button
                          onClick={() => handleStatusChange(item, 'Çözüldü')}
                          className="px-2.5 py-1 rounded-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          Çözüldü
                        </button>
                      )}
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
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
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
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
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
              className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Proje & Kat Planı">Proje & Kat Planı</option>
                <option value="Satış Öncesi Bilgi">Satış Öncesi Bilgi</option>
                <option value="Ödeme & Finansman">Ödeme & Finansman</option>
                <option value="Satış Sonrası Destek">Satış Sonrası Destek</option>
                <option value="Genel Talep">Genel Talep</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#f3efe9] mb-1">
                Öncelik
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                className="w-full px-3 py-2 rounded-[14px] bg-[#24211f] border border-[#4a443f] text-xs text-white focus:outline-none focus:border-[#b99881]"
              >
                <option value="Düşük">Düşük</option>
                <option value="Orta">Orta</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Acil">Acil</option>
              </select>
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

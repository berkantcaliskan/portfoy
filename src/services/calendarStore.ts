import { createCrmServerCollection } from './crmServerCollection'
import { Department, CANONICAL_DEPARTMENTS } from '@/types/department'
import { AppUser, userStore } from './userStore'
import { appointmentStore, Appointment } from './appointmentStore'
import { isCentralCrm } from './crmRuntime'
import { leadStore } from './leadStore'
import { accountingStore } from './accountingStore'
import { requestStore } from './requestStore'
import { trashStore } from './trashStore'

export type CalendarEventCategory =
  | 'APPOINTMENT'      // Randevu
  | 'MEETING'          // Görüşme / Toplantı
  | 'FOLLOW_UP'        // Müşteri Takip / Geri Arama
  | 'DEPARTMENT_PLAN'  // Departman Planı
  | 'INTER_DEPARTMENT' // Departmanlar Arası Plan
  | 'COMPANY_EVENT'    // Tüm Şirket Planı
  | 'FINANCE'          // Tahsilat / Ödeme Vadesi
  | 'TASK'             // Görev / Hatırlatma

export type CalendarVisibilityScope =
  | 'PERSONAL'   // Kişisel (Sadece oluşturan kişi)
  | 'USERS'      // Kişisel / Belirli Kişiler (Grup)
  | 'DEPARTMENT' // Departman (Tekil: 1 departman, Çoğul: Departmanlar Arası 2+ departman)
  | 'COMPANY'    // Tüm Şirket

export type CalendarAutoSource =
  | 'MANUAL'
  | 'APPOINTMENT'
  | 'LEAD_NOTE'
  | 'COLLECTION'
  | 'PAYMENT'
  | 'REQUEST'
  | 'TOOL_PAYMENT'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  endTime?: string // HH:mm
  location?: string
  category: CalendarEventCategory
  visibilityScope: CalendarVisibilityScope
  sharedDepartments: Department[] // Tekil (1) veya Çoğul (2+ departmanlar arası)
  sharedUserIds: string[]         // Kişisel veya grup paylaşımı için kullanıcı ID'leri
  sharedUserNames: string[]       // Görüntüleme amaçlı kullanıcı isimleri
  createdByUserId: string
  createdByUserName: string
  createdByDepartment: Department
  companyName: string
  isAutoSynced?: boolean
  autoSource?: CalendarAutoSource
  sourceRefId?: string
  customerName?: string
  customerPhone?: string
  projectName?: string
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
}

export const CATEGORY_META: Record<
  CalendarEventCategory,
  { label: string; badgeClass: string; dotColor: string }
> = {
  APPOINTMENT: {
    label: 'Randevu',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    dotColor: '#6366f1',
  },
  MEETING: {
    label: 'Görüşme / Toplantı',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dotColor: '#0ea5e9',
  },
  FOLLOW_UP: {
    label: 'Müşteri Takip',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotColor: '#f59e0b',
  },
  DEPARTMENT_PLAN: {
    label: 'Departman Planı',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: '#14b8a6',
  },
  INTER_DEPARTMENT: {
    label: 'Departmanlar Arası',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dotColor: '#a855f7',
  },
  COMPANY_EVENT: {
    label: 'Tüm Şirket Planı',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotColor: '#10b981',
  },
  FINANCE: {
    label: 'Finans / Vade',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotColor: '#f43f5e',
  },
  TASK: {
    label: 'Görev / Hatırlatma',
    badgeClass: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
    dotColor: '#78716c',
  },
}

const STORAGE_KEY_CALENDAR = 'demirturk_calendar_store_v1'

interface StoredCalendarData {
  manualEvents: CalendarEvent[]
  overrides: Record<string, Partial<CalendarEvent>>
  deletedAutoIds: string[]
}

type Listener = () => void

/**
 * Metin içinden tarih (GG.AA.YYYY, GG/AA/YYYY, YYYY-MM-DD, "yarın", "bugün") ve saat (SS:DD) yakalar.
 */
export function extractDateAndTimeFromText(
  text?: string,
  fallbackBaseDateIso?: string
): { date: string; time: string } | null {
  if (!text || !text.trim()) return null
  const raw = text.trim()
  const baseDate = fallbackBaseDateIso ? new Date(fallbackBaseDateIso) : new Date()
  if (isNaN(baseDate.getTime())) return null

  let detectedDate: string | null = null
  let detectedTime = '14:00'

  // Saat yakala (Örn: 14:30, saat 15.00, 11:00'de)
  const timeMatch = raw.match(/(?:saat\s*)?(\b[01]?\d|2[0-3])[:.](\d{2})\b/i)
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0')
    const mm = timeMatch[2]
    detectedTime = `${hh}:${mm}`
  }

  // 1. YYYY-MM-DD
  const isoMatch = raw.match(/\b(20\d{2})-([01]\d)-([0-3]\d)\b/)
  if (isoMatch) {
    detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  // 2. DD.MM.YYYY veya DD/MM/YYYY
  if (!detectedDate) {
    const trFullMatch = raw.match(/\b([0-3]?\d)[./]([01]?\d)[./](20\d{2})\b/)
    if (trFullMatch) {
      const dd = trFullMatch[1].padStart(2, '0')
      const mm = trFullMatch[2].padStart(2, '0')
      const yyyy = trFullMatch[3]
      detectedDate = `${yyyy}-${mm}-${dd}`
    }
  }

  // 3. DD Ocak / Şubat / ... [YYYY]
  if (!detectedDate) {
    const monthMap: Record<string, string> = {
      ocak: '01',
      şubat: '02',
      subat: '02',
      mart: '03',
      nisan: '04',
      mayıs: '05',
      mayis: '05',
      haziran: '06',
      temmuz: '07',
      ağustos: '08',
      agustos: '08',
      eylül: '09',
      eylul: '09',
      ekim: '10',
      kasım: '11',
      kasim: '11',
      aralık: '12',
      aralik: '12',
    }
    const monthRegex =
      /\b([0-3]?\d)\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(20\d{2}))?\b/i
    const mMatch = raw.match(monthRegex)
    if (mMatch) {
      const dd = mMatch[1].padStart(2, '0')
      const mm = monthMap[mMatch[2].toLowerCase()] || '01'
      const yyyy = mMatch[3] || String(baseDate.getFullYear())
      detectedDate = `${yyyy}-${mm}-${dd}`
    }
  }

  // 4. "yarın" / "bugün" / "ertesi gün" (randevu/görüşme/arama bağlamında)
  if (!detectedDate) {
    const lower = raw.toLocaleLowerCase('tr-TR')
    if (/\byarın\b/.test(lower)) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + 1)
      detectedDate = d.toISOString().slice(0, 10)
    } else if (
      /\bbugün\b/.test(lower) &&
      (timeMatch || /\b(randevu|görüşme|toplantı|aranacak|arayacak)\b/.test(lower))
    ) {
      detectedDate = baseDate.toISOString().slice(0, 10)
    }
  }

  if (!detectedDate) return null
  return { date: detectedDate, time: detectedTime }
}

class CalendarStore {
 private backend=createCrmServerCollection<CalendarEvent>('calendar',()=>{const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null})
 private overrideBackend=createCrmServerCollection<{id:string; updates?:Partial<CalendarEvent>; hidden?:boolean}>('calendar_overrides',()=>{const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null})
 public setAccount(id:string|null) { this.backend.setAccount(id);this.overrideBackend.setAccount(id);this.manualEvents=[];this.overrides={};this.deletedAutoIds.clear();this.notify() }
 public async refreshFromBackend() { await Promise.all([this.backend.refresh(),this.overrideBackend.refresh()]) }
 public getReadError() { return this.backend.getError()||this.overrideBackend.getError() }

  private manualEvents: CalendarEvent[] = []
  private overrides: Record<string, Partial<CalendarEvent>> = {}
  private deletedAutoIds: Set<string> = new Set()
  private listeners: Set<Listener> = new Set()

  constructor() {
 this.backend.subscribe(()=>{if(isCentralCrm()){this.manualEvents=this.backend.getAll();this.notify()}})
 this.overrideBackend.subscribe(()=>{if(isCentralCrm()){const rows=this.overrideBackend.getAll();this.overrides=Object.fromEntries(rows.filter(r=>r.updates).map(r=>[r.id,r.updates!]));this.deletedAutoIds=new Set(rows.filter(r=>r.hidden).map(r=>r.id));this.notify()}})

    this.loadFromStorage()

    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }

    // Diğer store'lar güncellendiğinde takvimi otomatik senkronize et
    appointmentStore.subscribe(() => this.notify())
    leadStore.subscribe(() => this.notify())
    accountingStore.subscribe(() => this.notify())
    requestStore.subscribe(() => this.notify())
    userStore.subscribe(() => this.notify())
  }

  private loadFromStorage() {
    if(isCentralCrm())return
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CALENDAR)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredCalendarData
        this.manualEvents = Array.isArray(parsed.manualEvents) ? parsed.manualEvents : []
        this.overrides = parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
        this.deletedAutoIds = new Set(Array.isArray(parsed.deletedAutoIds) ? parsed.deletedAutoIds : [])
      }
    } catch {
      this.manualEvents = []
      this.overrides = {}
      this.deletedAutoIds = new Set()
    }
  }

  private saveToStorage() {
    if(isCentralCrm()){this.notify();return}
    try {
      const payload: StoredCalendarData = {
        manualEvents: this.manualEvents,
        overrides: this.overrides,
        deletedAutoIds: Array.from(this.deletedAutoIds),
      }
      localStorage.setItem(STORAGE_KEY_CALENDAR, JSON.stringify(payload))
    } catch (e) {
      console.error('[CalendarStore] save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Sistemdeki randevu, görüşme, müşteri takibi, tahsilat ve ödeme kayıtlarını
   * ilgili departman (tekil/çoğul) ve kişilerle otomatik eşleştirerek üretir.
   */
  private buildAutoSyncedEvents(): CalendarEvent[] {
    const allUsers = userStore.getAll()
    const currentUser = userStore.getCurrentUser()
    const defaultCompany = currentUser?.companyName || 'Demirtürk Portföy'
    const autoEvents: CalendarEvent[] = []

    const findUserByNameOrId = (id?: string, name?: string): AppUser | undefined => {
      if (id) {
        const byId = allUsers.find((u) => u.id === id)
        if (byId) return byId
      }
      if (name) {
        const norm = name.trim().toLocaleLowerCase('tr-TR')
        return allUsers.find((u) => u.fullName.trim().toLocaleLowerCase('tr-TR') === norm)
      }
      return undefined
    }

    // 1. RANDEVULAR (appointmentStore) -> Otomatik olarak oluşturan ve atanan departmanlarla paylaşılır
    const appointments = appointmentStore.getAll(null)
    for (const apt of appointments) {
      const eventId = `cal-apt-${apt.id}`
      if (this.deletedAutoIds.has(eventId)) continue

      const deptSet = new Set<Department>()
      if (apt.createdByDepartment && CANONICAL_DEPARTMENTS.includes(apt.createdByDepartment)) {
        deptSet.add(apt.createdByDepartment)
      }

      const assignedUser = findUserByNameOrId(apt.assignedToUserId, apt.assignedToUserName)
      const creatorUser = findUserByNameOrId(apt.createdByUserId, undefined)

      if (assignedUser?.department) {
        deptSet.add(assignedUser.department)
      }
      if (creatorUser?.department) {
        deptSet.add(creatorUser.department)
      }

      // Eğer müşteriyle ilgili bir randevuysa ve ilgili lead'in geçmişinde Müşteri İlişkileri / Satış devri varsa
      if (apt.leadId) {
        const linkedLead = leadStore.getAllRaw().find((l) => l.id === apt.leadId)
        if (linkedLead?.assignmentHistory && linkedLead.assignmentHistory.length > 0) {
          deptSet.add('Müşteri İlişkileri')
          deptSet.add('Satış')
        }
      }

      if (deptSet.size === 0) {
        deptSet.add('Satış')
        deptSet.add('Müşteri İlişkileri')
      }

      const sharedDepartments = Array.from(deptSet)
      const sharedUserIds = Array.from(
        new Set([apt.createdByUserId, assignedUser?.id].filter(Boolean) as string[])
      )
      const sharedUserNames = Array.from(
        new Set([creatorUser?.fullName, apt.assignedToUserName].filter(Boolean) as string[])
      )

      const typeLabel =
        apt.type === 'ON_SITE' ? 'Şantiye' : apt.type === 'ONLINE' ? 'Online' : 'Ofis'

      const baseEvent: CalendarEvent = {
        id: eventId,
        title: `Randevu: ${apt.customerName}`,
        description:
          apt.notes ||
          `${typeLabel} randevusu${apt.projectName ? ` • ${apt.projectName}` : ''}`,
        date: apt.date,
        time: apt.time || '14:00',
        location: apt.location,
        category: 'APPOINTMENT',
        visibilityScope: 'DEPARTMENT',
        sharedDepartments,
        sharedUserIds,
        sharedUserNames,
        createdByUserId: apt.createdByUserId || assignedUser?.id || 'system',
        createdByUserName: creatorUser?.fullName || apt.assignedToUserName || 'Sistem',
        createdByDepartment: apt.createdByDepartment || 'Satış',
        companyName: creatorUser?.companyName || assignedUser?.companyName || defaultCompany,
        isAutoSynced: true,
        autoSource: 'APPOINTMENT',
        sourceRefId: apt.id,
        customerName: apt.customerName,
        customerPhone: apt.customerPhone,
        projectName: apt.projectName,
        status: apt.status === 'COMPLETED' ? 'COMPLETED' : apt.status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED',
        createdAt: apt.createdAt,
        updatedAt: apt.createdAt,
      }

      const override = this.overrides[eventId]
      autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
    }

    // 2. MÜŞTERİ GÖRÜŞME / GERİ ARAMA NOTLARI VE RANDEVU AŞAMASI (leadStore)
    const rawLeads = leadStore.getAllRaw()
    for (const lead of rawLeads) {
      const eventId = `cal-lead-${lead.id}`
      if (this.deletedAutoIds.has(eventId)) continue

      // Zaten bu lead için appointmentStore'da kayıt varsa mükerrer oluşturma
      const hasExplicitApt = appointments.some(
        (a) =>
          a.leadId === lead.id ||
          a.customerName.trim().toLocaleLowerCase('tr-TR') ===
            lead.fullName.trim().toLocaleLowerCase('tr-TR')
      )
      if (hasExplicitApt) continue

      const parsedFromNotes = extractDateAndTimeFromText(lead.notes, lead.updatedAt || lead.createdAt)
      const isAppointmentStage = lead.stage === 'APPOINTMENT' || lead.stage === 'PRESENTATION'

      if (!parsedFromNotes && !isAppointmentStage) continue

      const eventDate =
        parsedFromNotes?.date || (lead.updatedAt || lead.createdAt).slice(0, 10)
      const eventTime =
        parsedFromNotes?.time || (lead.updatedAt || lead.createdAt).slice(11, 16) || '14:00'

      const deptSet = new Set<Department>()
      const assignee = findUserByNameOrId(lead.assignedToUserId, lead.assignedToUserName)
      if (assignee?.department) {
        deptSet.add(assignee.department)
      }

      if (lead.assignmentHistory && lead.assignmentHistory.length > 0) {
        deptSet.add('Müşteri İlişkileri')
        deptSet.add('Satış')
      } else if (isAppointmentStage) {
        deptSet.add('Müşteri İlişkileri')
        deptSet.add('Satış')
      } else if (deptSet.size === 0) {
        deptSet.add('Müşteri İlişkileri')
      }

      const sharedDepartments = Array.from(deptSet)
      const sharedUserIds = assignee ? [assignee.id] : []
      const sharedUserNames = lead.assignedToUserName ? [lead.assignedToUserName] : []

      const baseEvent: CalendarEvent = {
        id: eventId,
        title: isAppointmentStage
          ? `Görüşme / Sunum: ${lead.fullName}`
          : `Müşteri Takip: ${lead.fullName}`,
        description:
          lead.notes ||
          `${lead.formName || 'Müşteri Kaydı'}${
            lead.preferredHousingType ? ` • ${lead.preferredHousingType}` : ''
          }`,
        date: eventDate,
        time: eventTime,
        category: isAppointmentStage ? 'MEETING' : 'FOLLOW_UP',
        visibilityScope: 'DEPARTMENT',
        sharedDepartments,
        sharedUserIds,
        sharedUserNames,
        createdByUserId: assignee?.id || 'system',
        createdByUserName: lead.assignedToUserName || lead.owner || 'Müşteri İlişkileri',
        createdByDepartment: assignee?.department || 'Müşteri İlişkileri',
        companyName: lead.companyName || defaultCompany,
        isAutoSynced: true,
        autoSource: 'LEAD_NOTE',
        sourceRefId: lead.id,
        customerName: lead.fullName,
        customerPhone: lead.phone,
        status: 'SCHEDULED',
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }

      const override = this.overrides[eventId]
      autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
    }

    // 3. MUHASEBE TAHSİLAT VADE TARİHLERİ (accountingStore.getCollections) -> Muhasebe & Satış
    const collections = accountingStore.getCollections()
    for (const col of collections) {
      if (!col.dueDate) continue
      const eventId = `cal-col-${col.id}`
      if (this.deletedAutoIds.has(eventId)) continue

      const sharedDepartments: Department[] = ['Muhasebe', 'Satış']
      const typeLabel =
        col.type === 'DEPOSIT'
          ? 'Kapora'
          : col.type === 'DOWN_PAYMENT'
          ? 'Peşinat'
          : col.type === 'INSTALLMENT'
          ? 'Taksit'
          : 'Tapu / Tam Ödeme'

      const baseEvent: CalendarEvent = {
        id: eventId,
        title: `Tahsilat (${typeLabel}): ${col.customerName}`,
        description: `${col.projectName} • Daire ${col.unitNumber}${col.notes ? ` • ${col.notes}` : ''}`,
        date: col.dueDate.slice(0, 10),
        time: '10:00',
        location: col.projectName,
        category: 'FINANCE',
        visibilityScope: 'DEPARTMENT',
        sharedDepartments,
        sharedUserIds: [],
        sharedUserNames: [],
        createdByUserId: 'system',
        createdByUserName: 'Muhasebe',
        createdByDepartment: 'Muhasebe',
        companyName: defaultCompany,
        isAutoSynced: true,
        autoSource: 'COLLECTION',
        sourceRefId: col.id,
        customerName: col.customerName,
        projectName: col.projectName,
        status: col.status === 'COLLECTED' ? 'COMPLETED' : col.status === 'REFUNDED' ? 'CANCELLED' : 'SCHEDULED',
        createdAt: col.createdAt,
        updatedAt: col.createdAt,
      }

      const override = this.overrides[eventId]
      autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
    }

    // 4. MUHASEBE ÖDEME VADE TARİHLERİ (accountingStore.getPayments) -> İlgili Departmanlar
    const payments = accountingStore.getPayments()
    for (const pay of payments) {
      if (!pay.dueDate) continue
      const eventId = `cal-pay-${pay.id}`
      if (this.deletedAutoIds.has(eventId)) continue

      let sharedDepartments: Department[] = ['Muhasebe']
      if (pay.category === 'MARKETING') {
        sharedDepartments = ['Muhasebe', 'Pazarlama']
      } else if (pay.category === 'COMMISSION') {
        sharedDepartments = ['Muhasebe', 'Satış']
      } else if (pay.category === 'CONSTRUCTION' || pay.category === 'TAX') {
        sharedDepartments = ['Muhasebe', 'Yönetim']
      }

      const baseEvent: CalendarEvent = {
        id: eventId,
        title: `Ödeme: ${pay.title}`,
        description: `Alıcı: ${pay.payee}${pay.notes ? ` • ${pay.notes}` : ''}`,
        date: pay.dueDate.slice(0, 10),
        time: '11:00',
        category: 'FINANCE',
        visibilityScope: 'DEPARTMENT',
        sharedDepartments,
        sharedUserIds: [],
        sharedUserNames: [],
        createdByUserId: 'system',
        createdByUserName: 'Muhasebe',
        createdByDepartment: 'Muhasebe',
        companyName: defaultCompany,
        isAutoSynced: true,
        autoSource: 'PAYMENT',
        sourceRefId: pay.id,
        status: pay.status === 'PAID' ? 'COMPLETED' : 'SCHEDULED',
        createdAt: pay.createdAt,
        updatedAt: pay.createdAt,
      }

      const override = this.overrides[eventId]
      autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
    }

    // 5. TALEPLERDE TARİH İÇEREN KAYITLAR (requestStore) -> Müşteri İlişkileri & Satış
    const requests = requestStore.getAll()
    for (const req of requests) {
      const eventId = `cal-req-${req.id}`
      if (this.deletedAutoIds.has(eventId)) continue

      const parsed = extractDateAndTimeFromText(
        `${req.subject} ${req.notes}`,
        req.updatedAt || req.createdAt
      )
      if (!parsed) continue

      const assignee = findUserByNameOrId(undefined, req.assignedToUserName)
      const sharedDepartments: Department[] = ['Müşteri İlişkileri', 'Satış']
      if (req.category === 'Ödeme & Finansman') {
        sharedDepartments.push('Muhasebe')
      }

      const baseEvent: CalendarEvent = {
        id: eventId,
        title: `Talep Görüşmesi: ${req.customerName}`,
        description: `${req.subject}${req.notes ? ` • ${req.notes}` : ''}`,
        date: parsed.date,
        time: parsed.time,
        category: 'MEETING',
        visibilityScope: 'DEPARTMENT',
        sharedDepartments: Array.from(new Set(sharedDepartments)),
        sharedUserIds: assignee ? [assignee.id] : [],
        sharedUserNames: req.assignedToUserName ? [req.assignedToUserName] : [],
        createdByUserId: assignee?.id || 'system',
        createdByUserName: req.assignedToUserName || 'Müşteri İlişkileri',
        createdByDepartment: 'Müşteri İlişkileri',
        companyName: defaultCompany,
        isAutoSynced: true,
        autoSource: 'REQUEST',
        sourceRefId: req.id,
        customerName: req.customerName,
        customerPhone: req.customerPhone,
        status: req.status === 'Çözüldü' ? 'COMPLETED' : req.status === 'İptal' ? 'CANCELLED' : 'SCHEDULED',
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      }

      const override = this.overrides[eventId]
      autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
    }

    // 6. HIZLI ARAÇLAR ÖDEMELERDE TARİH İÇEREN KAYITLAR (demirturk_tool_payments_v1)
    try {
      const toolPaysRaw = localStorage.getItem('demirturk_tool_payments_v1')
      if (toolPaysRaw) {
        const toolPays = JSON.parse(toolPaysRaw) as {
          id: string
          item: string
          amount: number
          date: string
        }[]
        if (Array.isArray(toolPays)) {
          for (const tp of toolPays) {
            if (!tp.date) continue
            const eventId = `cal-tpay-${tp.id}`
            if (this.deletedAutoIds.has(eventId)) continue

            const baseEvent: CalendarEvent = {
              id: eventId,
              title: `Ödeme Planı: ${tp.item}`,
              description: `Tutar: ${new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: 'TRY',
                maximumFractionDigits: 0,
              }).format(tp.amount || 0)}`,
              date: tp.date.slice(0, 10),
              time: '12:00',
              category: 'FINANCE',
              visibilityScope: 'DEPARTMENT',
              sharedDepartments: ['Muhasebe', 'Yönetim'],
              sharedUserIds: currentUser ? [currentUser.id] : [],
              sharedUserNames: currentUser ? [currentUser.fullName] : [],
              createdByUserId: currentUser?.id || 'system',
              createdByUserName: currentUser?.fullName || 'Muhasebe',
              createdByDepartment: currentUser?.department || 'Muhasebe',
              companyName: defaultCompany,
              isAutoSynced: true,
              autoSource: 'TOOL_PAYMENT',
              sourceRefId: tp.id,
              status: 'SCHEDULED',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            const override = this.overrides[eventId]
            autoEvents.push(override ? { ...baseEvent, ...override, id: eventId } : baseEvent)
          }
        }
      }
    } catch {}

    return autoEvents
  }

  /**
   * Tüm etkinlikleri (manuel + otomatik senkronize) döner.
   */
  public getAllRaw(): CalendarEvent[] {
    const autoEvents = this.buildAutoSyncedEvents()
    const combined = [...this.manualEvents, ...autoEvents]
    return combined.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date)
      if (cmpDate !== 0) return cmpDate
      return (a.time || '00:00').localeCompare(b.time || '00:00')
    })
  }

  /**
   * Kullanıcının görmeye yetkili olduğu veya onunla/departmanıyla/şirketle paylaşılan etkinlikleri döner.
   */
  public getVisibleEvents(user?: AppUser | null): CalendarEvent[] {
    const all = this.getAllRaw()
    if (!user) return all

    return all.filter((ev) => {
      // Şirket izolasyonu
      if (ev.companyName && user.companyName && ev.companyName !== user.companyName) {
        return false
      }

      // Admin veya Yönetim tüm şirket etkinliklerini görebilir (Kişisel/Sadece Ben olarak işaretlenen başkasının özel notu hariç)
      if (ev.visibilityScope === 'PERSONAL') {
        return (
          ev.createdByUserId === user.id ||
          ev.createdByUserName === user.fullName ||
          ev.sharedUserIds.includes(user.id) ||
          ev.sharedUserNames.includes(user.fullName)
        )
      }

      if (ev.visibilityScope === 'COMPANY') {
        return true
      }

      if (user.role === 'ADMIN' || user.department === 'Yönetim') {
        return true
      }

      if (ev.visibilityScope === 'USERS') {
        return (
          ev.createdByUserId === user.id ||
          ev.createdByUserName === user.fullName ||
          ev.sharedUserIds.includes(user.id) ||
          ev.sharedUserNames.includes(user.fullName)
        )
      }

      if (ev.visibilityScope === 'DEPARTMENT') {
        const userDepts = new Set<Department>([
          user.department,
          ...(user.departments || []),
        ])
        const matchesDept = ev.sharedDepartments.some((d) => userDepts.has(d))
        const matchesUser =
          ev.createdByUserId === user.id ||
          ev.createdByUserName === user.fullName ||
          ev.sharedUserIds.includes(user.id) ||
          ev.sharedUserNames.includes(user.fullName)
        return matchesDept || matchesUser
      }

      return true
    })
  }

  /**
   * Manuel yeni plan/etkinlik ekler.
   */
  public async addEvent(
    data: {
      title: string
      description?: string
      date: string
      time: string
      endTime?: string
      location?: string
      category: CalendarEventCategory
      visibilityScope: CalendarVisibilityScope
      sharedDepartments: Department[]
      sharedUserIds: string[]
      sharedUserNames: string[]
      customerName?: string
      customerPhone?: string
      projectName?: string
    },
    user?: AppUser | null
  ): Promise<CalendarEvent> {
    const activeUser = user || userStore.getCurrentUser()
    const nowIso = new Date().toISOString()

    const newEvent: CalendarEvent = {
      id: isCentralCrm()?crypto.randomUUID():'cal-manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: data.title.trim(),
      description: data.description?.trim() || '',
      date: data.date,
      time: data.time || '10:00',
      endTime: data.endTime,
      location: data.location?.trim() || '',
      category: data.category,
      visibilityScope: data.visibilityScope,
      sharedDepartments: data.sharedDepartments || [],
      sharedUserIds: data.sharedUserIds || [],
      sharedUserNames: data.sharedUserNames || [],
      createdByUserId: activeUser?.id || 'usr-berkant',
      createdByUserName: activeUser?.fullName || 'Berkant Demirtürk',
      createdByDepartment: activeUser?.department || 'Yönetim',
      companyName: activeUser?.companyName || 'Demirtürk Portföy',
      isAutoSynced: false,
      autoSource: 'MANUAL',
      customerName: data.customerName?.trim(),
      customerPhone: data.customerPhone?.trim(),
      projectName: data.projectName?.trim(),
      status: 'SCHEDULED',
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    if(isCentralCrm())return this.backend.save(JSON.stringify(newEvent),newEvent)
    this.manualEvents = [newEvent, ...this.manualEvents]
    this.saveToStorage()
    return newEvent
  }

  /**
   * Hem manuel hem de otomatik kaydedilmiş bir etkinliği düzenler (görünürlük, departman, kişi/grup, tarih, başlık vb.).
   */
  public async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const nowIso = new Date().toISOString()

    // 1. Manuel etkinlik mi?
    const manualIdx = this.manualEvents.findIndex((e) => e.id === id)
    if (manualIdx !== -1) {
      const updated: CalendarEvent = {
        ...this.manualEvents[manualIdx],
        ...updates,
        id,
        updatedAt: nowIso,
      }
      if(isCentralCrm())return this.backend.save(JSON.stringify(updated),updated)
      this.manualEvents[manualIdx] = updated
      this.saveToStorage()
      return updated
    }

    // 2. Otomatik senkronize etkinlik (Randevu, Görüşme, Tahsilat, Ödeme vb.)
    // Eğer bir Randevu (appointmentStore) kaydıysa temel alanları appointmentStore'a da yansıt
    if (id.startsWith('cal-apt-')) {
      const aptId = id.replace('cal-apt-', '')
      const aptUpdates: Partial<Appointment> = {}
      if (updates.date) aptUpdates.date = updates.date
      if (updates.time) aptUpdates.time = updates.time
      if (updates.location !== undefined) aptUpdates.location = updates.location
      if (updates.description !== undefined) aptUpdates.notes = updates.description
      if (updates.status) aptUpdates.status = updates.status
      if (Object.keys(aptUpdates).length > 0) {
        if (!await appointmentStore.updateAppointment(aptId, aptUpdates)) {
          throw new Error('Takvimdeki randevu bulunamadı. Randevu listesini yenileyin.')
        }
      }
    }

    const overrides = { ...(this.overrides[id] || {}), ...updates, updatedAt: nowIso }
    if (isCentralCrm() && id.startsWith('cal-apt-')) {
      // Sunucudan gelen randevu alanlarını tarayıcıdaki eski değerlerle gölgeleme.
      delete overrides.date
      delete overrides.time
      delete overrides.location
      delete overrides.description
      delete overrides.status
    }
    if(isCentralCrm())await this.overrideBackend.save(JSON.stringify([id,overrides]),{id,updates:overrides})
    this.overrides[id] = overrides

    this.saveToStorage()
    return this.getAllRaw().find((e) => e.id === id)
  }

  /**
   * Etkinliği siler.
   */
  public async deleteEvent(id: string): Promise<void> {
    if(isCentralCrm()) { const manual=this.manualEvents.find(e=>e.id===id); if(manual)await this.backend.save('archive:'+id,manual,true); else await this.overrideBackend.save('hide:'+id,{id,hidden:true}); return }

    const target = this.getAllRaw().find((e) => e.id === id)
    if (target) {
      trashStore.addItemToTrash(STORAGE_KEY_CALENDAR, target)
    }
    const isManual = this.manualEvents.some((e) => e.id === id)
    if (isManual) {
      this.manualEvents = this.manualEvents.filter((e) => e.id !== id)
    } else {
      this.deletedAutoIds.add(id)
    }
    this.saveToStorage()
  }
}

export const calendarStore = new CalendarStore()

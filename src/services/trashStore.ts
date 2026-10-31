// 30-Day Cross-Department Trash Bin Store (Çöp Kutusu)
// Retains deleted items from all departments and pages for 30 days before permanent removal.

export const TRASH_STORAGE_KEY = 'demirturk_trash_bin_v1'
export const TRASH_RETENTION_DAYS = 30
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

export interface TrashItem {
  trashId: string
  storeKey: string
  itemId: string
  itemKey?: string
  department: string
  pageName: string
  title: string
  subtitle: string
  deletedAt: string
  expiresAt: string
  payload: any
}

export function describeTrashTarget(
  storeKey: string,
  item: any
): { department: string; pageName: string; title: string; subtitle: string } | null {
  if (!item || typeof item !== 'object') return null

  switch (storeKey) {
    case 'demirturk_leads_v2': {
      const isWeb =
        item.source === 'WEBSITE' ||
        String(item.id || '').startsWith('lead-web-') ||
        (Array.isArray(item.inquiries) &&
          item.inquiries.some((inq: any) => inq?.source === 'WEBSITE'))
      const sourceLabel =
        item.source === 'META_ADS'
          ? 'Meta Form'
          : isWeb
          ? 'Web Sitesi'
          : item.source === 'WHATSAPP'
          ? 'WhatsApp'
          : 'Manuel Kayıt'
      const isRequest = isWeb || item.source === 'MANUAL'
      return {
        department: isRequest ? 'Müşteri İlişkileri / Satış' : 'Pazarlama / Satış',
        pageName: isRequest ? 'Müşteriler & Talepler' : 'Müşteriler',
        title: String(item.fullName || 'İsimsiz Müşteri'),
        subtitle: [
          item.phone,
          item.formName || item.preferredHousingType || item.projectName,
          sourceLabel,
        ]
          .filter(Boolean)
          .join(' • '),
      }
    }
    case 'demirturk_requests_v2':
    case 'demirturk_customer_requests_v2':
      return {
        department: 'Müşteri İlişkileri',
        pageName: 'Talepler',
        title: String(item.customerName || item.subject || item.title || 'Müşteri Talebi'),
        subtitle: [item.customerPhone, item.subject, item.category || item.type]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_appointments_v2':
      return {
        department: 'Satış',
        pageName: 'Randevular',
        title: String(item.customerName || item.title || 'Satış Randevusu'),
        subtitle: [
          item.date,
          item.time,
          item.projectName || item.assignedToUserName || item.assignedTo,
        ]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_shared_files_v2':
      return {
        department: String(item.department || 'Ortak'),
        pageName: 'Paylaşılanlar',
        title: String(item.name || item.title || 'Paylaşılan Dosya'),
        subtitle: [item.notes || item.category, item.size, item.uploadedByName || item.uploadedBy]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_projects_v2':
    case 'demirturk_shared_projects_v2':
      return {
        department: 'Satış',
        pageName: 'Projeler',
        title: String(item.name || item.title || 'Proje'),
        subtitle: [item.location, item.status].filter(Boolean).join(' • '),
      }
    case 'demirturk_creatives_v1':
      return {
        department: 'Kreatif',
        pageName: 'Stüdyo',
        title: String(item.title || item.name || 'Kreatif Çalışma'),
        subtitle: [item.projectName, item.platform || item.format].filter(Boolean).join(' • '),
      }
    case 'demirturk_creative_schedule_v1':
      return {
        department: 'Kreatif',
        pageName: 'Çizelge',
        title: String(item.title || item.name || 'Çizelge Etkinliği'),
        subtitle: [item.date, item.category || item.platform].filter(Boolean).join(' • '),
      }
    case 'demirturk_creative_briefs_v1':
      return {
        department: 'Kreatif',
        pageName: "Brief'ler",
        title: String(item.title || item.projectName || 'Kreatif Brief'),
        subtitle: [item.requestedBy, item.dueDate || item.status].filter(Boolean).join(' • '),
      }
    case 'demirturk_creative_comments_v1':
      return {
        department: 'Kreatif',
        pageName: 'Yorumlar',
        title: String(item.authorName || 'Yorum'),
        subtitle: String(item.text || item.content || ''),
      }
    case 'demirturk_collections_v2':
      return {
        department: 'Muhasebe',
        pageName: 'Tahsilatlar',
        title: String(item.customerName || item.title || 'Tahsilat Kaydı'),
        subtitle: [item.projectName, item.amount ? `${item.amount} ₺` : '', item.dueDate]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_payments_v2':
    case 'demirturk_tool_payments_v1':
      return {
        department: 'Muhasebe',
        pageName: 'Ödemeler',
        title: String(
          item.vendorName || item.item || item.title || item.description || 'Ödeme Kaydı'
        ),
        subtitle: [item.category, item.amount ? `${item.amount} ₺` : '', item.date]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_approvals_v2':
      return {
        department: 'Yönetim',
        pageName: 'Onaylar',
        title: String(item.title || item.subject || 'Onay Talebi'),
        subtitle: [item.department, item.requestedBy].filter(Boolean).join(' • '),
      }
    case 'demirturk_team_assets_v1':
      return {
        department: 'Yönetim',
        pageName: 'Ekipler (Zimmet)',
        title: String(item.name || item.title || 'Zimmet Eşyası'),
        subtitle: [item.category, item.codeOrPlate || item.holderUserName || item.assignedToName]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_team_leaves_v1':
      return {
        department: 'Yönetim',
        pageName: 'Ekipler (İzinler)',
        title: String(item.userName || item.fullName || 'İzin Kaydı'),
        subtitle: [item.type, item.startDate, item.endDate].filter(Boolean).join(' • '),
      }
    case 'demirturk_users_v2':
      return {
        department: String(item.department || 'Yönetim'),
        pageName: 'Ekip Üyeleri',
        title: String(item.fullName || item.username || 'Kullanıcı'),
        subtitle: [
          item.username ? `@${item.username}` : '',
          item.roleTitle || item.department,
        ]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_google_ads_campaigns_v1':
      return {
        department: 'Pazarlama',
        pageName: 'Kampanyalar',
        title: String(item.name || 'Kampanya'),
        subtitle: [item.status, item.channelType].filter(Boolean).join(' • '),
      }
    case 'demirturk_contacts_v2':
      return {
        department: 'Ortak',
        pageName: 'Rehber',
        title: String(item.fullName || 'Kişi Kaydı'),
        subtitle: [item.phone, item.company, item.category].filter(Boolean).join(' • '),
      }
    case 'demirturk_calendar_store_v1':
      return {
        department: String(item.createdByDepartment || 'Ortak'),
        pageName: 'Takvim & Planlayıcı',
        title: String(item.title || 'Takvim Etkinliği'),
        subtitle: [item.date, item.time, item.customerName || item.location]
          .filter(Boolean)
          .join(' • '),
      }
    case 'demirturk_mail_messages_v2':
      return {
        department: 'Ortak',
        pageName: 'E-Posta',
        title: String(item.subject || 'E-Posta İletisi'),
        subtitle: [item.fromName || item.fromAddress, item.toAddress].filter(Boolean).join(' • '),
      }
    default:
      return {
        department: String(item.department || 'Ortak'),
        pageName: 'Silinen Kayıtlar',
        title: String(
          item.title ||
            item.name ||
            item.fullName ||
            item.customerName ||
            item.subject ||
            item.id ||
            'Silinen Öge'
        ),
        subtitle: [item.phone || item.customerPhone, item.notes || item.description]
          .filter(Boolean)
          .join(' • '),
      }
  }
}

const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn()
    } catch {}
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('demirturk:trash-updated'))
  }
}

function readRawTrash(): TrashItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(TRASH_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    const valid = parsed.filter((item) => {
      if (!item || typeof item !== 'object' || !item.trashId) return false
      const exp = new Date(item.expiresAt || 0).getTime()
      return !isNaN(exp) && exp > now
    })
    if (valid.length !== parsed.length) {
      window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(valid))
    }
    return valid.sort(
      (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
    )
  } catch {
    return []
  }
}

function canonicalStoreKey(storeKey: string): string {
  if (storeKey === 'demirturk_customer_requests_v2') return 'demirturk_requests_v2'
  if (storeKey === 'demirturk_shared_projects_v2') return 'demirturk_projects_v2'
  return storeKey
}

export const trashStore = {
  getAll(): TrashItem[] {
    return readRawTrash()
  },

  getDaysRemaining(item: TrashItem): number {
    const exp = new Date(item.expiresAt).getTime()
    const diff = exp - Date.now()
    if (isNaN(exp) || diff <= 0) return 0
    return Math.max(1, Math.min(30, Math.ceil(diff / (24 * 60 * 60 * 1000))))
  },

  addItemToTrash(storeKey: string, item: any, itemKey?: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    if (!item || typeof item !== 'object') return
    const normStoreKey = canonicalStoreKey(storeKey)
    const meta = describeTrashTarget(normStoreKey, item)
    if (!meta) return

    const itemId = String(item.id || item.username || itemKey || Date.now())
    const computedKey =
      itemKey ||
      (normStoreKey === 'demirturk_leads_v2' && item.phone
        ? `phone:${String(item.phone).replace(/\D/g, '').slice(-10)}`
        : itemId)

    try {
      const list = readRawTrash()
      const nowMs = Date.now()
      const deletedAt = new Date(nowMs).toISOString()
      const expiresAt = new Date(nowMs + TRASH_RETENTION_MS).toISOString()

      const filtered = list.filter(
        (x) =>
          !(
            canonicalStoreKey(x.storeKey) === normStoreKey &&
            (x.itemId === itemId || (computedKey && x.itemKey === computedKey))
          )
      )

      const entry: TrashItem = {
        trashId: `trash-${normStoreKey}-${itemId}-${nowMs}`,
        storeKey: normStoreKey,
        itemId,
        itemKey: computedKey,
        department: meta.department,
        pageName: meta.pageName,
        title: meta.title,
        subtitle: meta.subtitle,
        deletedAt,
        expiresAt,
        payload: item,
      }

      const next = [entry, ...filtered].slice(0, 500)
      window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(next))
      notifyListeners()
    } catch {}
  },

  restoreItem(trashId: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const list = readRawTrash()
    const target = list.find((x) => x.trashId === trashId)
    if (!target || !target.payload) return false

    try {
      const normStoreKey = canonicalStoreKey(target.storeKey)

      // 1. Remove tombstone IDs (id, itemKey, phone, and any inquiry IDs) from demirturk_deleted_ids_v1
      const rawDel = window.localStorage.getItem('demirturk_deleted_ids_v1')
      if (rawDel) {
        try {
          const delArr: string[] = JSON.parse(rawDel)
          if (Array.isArray(delArr)) {
            const cleanPhone = String(
              target.payload?.phone || target.payload?.customerPhone || ''
            )
              .replace(/\D/g, '')
              .slice(-10)
            const phoneKey = cleanPhone.length >= 7 ? `phone:${cleanPhone}` : ''
            const inquiryIds = new Set<string>()
            if (Array.isArray(target.payload?.inquiries)) {
              for (const inq of target.payload.inquiries) {
                if (inq?.id) inquiryIds.add(String(inq.id))
              }
            }
            const nextDel = delArr.filter(
              (id) =>
                id !== target.itemId &&
                id !== target.itemKey &&
                id !== String(target.payload?.id || '') &&
                (!phoneKey || id !== phoneKey) &&
                !inquiryIds.has(id)
            )
            window.localStorage.setItem('demirturk_deleted_ids_v1', JSON.stringify(nextDel))
          }
        } catch {}
      }

      // 2. Restore payload into original storeKey
      if (normStoreKey === 'demirturk_calendar_store_v1') {
        try {
          const rawCal = window.localStorage.getItem('demirturk_calendar_store_v1')
          const calData = rawCal
            ? JSON.parse(rawCal)
            : { manualEvents: [], overrides: {}, deletedAutoIds: [] }
          if (target.payload.isAutoSynced) {
            calData.deletedAutoIds = (calData.deletedAutoIds || []).filter(
              (id: string) => id !== target.itemId && id !== target.payload.id
            )
          } else {
            const manualArr = Array.isArray(calData.manualEvents) ? calData.manualEvents : []
            if (!manualArr.some((e: any) => e?.id === target.payload.id)) {
              manualArr.unshift({
                ...target.payload,
                updatedAt: new Date().toISOString(),
              })
            }
            calData.manualEvents = manualArr
          }
          window.localStorage.setItem('demirturk_calendar_store_v1', JSON.stringify(calData))
        } catch {}
      } else {
        const rawStore = window.localStorage.getItem(normStoreKey)
        let storeArr: any[] = []
        if (rawStore) {
          try {
            const parsed = JSON.parse(rawStore)
            if (Array.isArray(parsed)) storeArr = parsed
          } catch {}
        }

        const restoredPayload = {
          ...target.payload,
          updatedAt: new Date().toISOString(),
        }
        const existsIdx = storeArr.findIndex(
          (x) =>
            (target.itemId && String(x?.id) === target.itemId) ||
            (target.payload?.id && String(x?.id) === String(target.payload.id)) ||
            (normStoreKey === 'demirturk_users_v2' &&
              x?.username &&
              String(x.username).toLowerCase() ===
                String(target.payload?.username || '').toLowerCase())
        )
        if (existsIdx >= 0) {
          storeArr[existsIdx] = restoredPayload
        } else {
          storeArr = [restoredPayload, ...storeArr]
        }
        window.localStorage.setItem(normStoreKey, JSON.stringify(storeArr))

        // Keep legacy alias keys in sync if applicable
        if (normStoreKey === 'demirturk_requests_v2') {
          window.localStorage.setItem('demirturk_customer_requests_v2', JSON.stringify(storeArr))
        } else if (normStoreKey === 'demirturk_projects_v2') {
          window.localStorage.setItem('demirturk_shared_projects_v2', JSON.stringify(storeArr))
        }
      }

      // 3. Remove from trash bin
      const remaining = list.filter((x) => x.trashId !== trashId)
      window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(remaining))

      window.dispatchEvent(new CustomEvent('demirturk:cloud-db-synced'))
      window.dispatchEvent(new Event('storage'))
      notifyListeners()
      return true
    } catch {
      return false
    }
  },

  restoreAll(): number {
    const items = readRawTrash()
    let count = 0
    for (const item of items) {
      if (this.restoreItem(item.trashId)) {
        count++
      }
    }
    return count
  },

  deletePermanently(trashId: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const list = readRawTrash()
    const remaining = list.filter((x) => x.trashId !== trashId)
    window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(remaining))
    notifyListeners()
  },

  emptyTrash(): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(TRASH_STORAGE_KEY, '[]')
    notifyListeners()
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onEvent = () => listener()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:trash-updated', onEvent)
      window.addEventListener('demirturk:cloud-db-synced', onEvent)
    }
    return () => {
      listeners.delete(listener)
      if (typeof window !== 'undefined') {
        window.removeEventListener('demirturk:trash-updated', onEvent)
        window.removeEventListener('demirturk:cloud-db-synced', onEvent)
      }
    }
  },
}

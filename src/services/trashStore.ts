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
      const sourceLabel =
        item.source === 'META_ADS'
          ? 'Meta Form'
          : item.source === 'WEBSITE'
          ? 'Web Sitesi'
          : item.source === 'WHATSAPP'
          ? 'WhatsApp'
          : 'Manuel Kayıt'
      const isRequest = item.source === 'WEBSITE' || item.source === 'MANUAL'
      return {
        department: isRequest ? 'Müşteri İlişkileri' : 'Pazarlama / Satış',
        pageName: isRequest ? 'Müşteriler & Talepler' : 'Müşteriler',
        title: String(item.fullName || 'İsimsiz Müşteri'),
        subtitle: [item.phone, item.projectName, sourceLabel].filter(Boolean).join(' • '),
      }
    }
    case 'demirturk_customer_requests_v2':
      return {
        department: 'Müşteri İlişkileri',
        pageName: 'Talepler',
        title: String(item.customerName || item.title || 'Müşteri Talebi'),
        subtitle: [item.customerPhone, item.projectName, item.type].filter(Boolean).join(' • '),
      }
    case 'demirturk_appointments_v2':
      return {
        department: 'Satış',
        pageName: 'Randevular',
        title: String(item.customerName || item.title || 'Satış Randevusu'),
        subtitle: [item.date, item.time, item.projectName || item.assignedTo].filter(Boolean).join(' • '),
      }
    case 'demirturk_shared_files_v2':
      return {
        department: String(item.department || 'Ortak'),
        pageName: 'Paylaşılanlar',
        title: String(item.name || item.title || 'Paylaşılan Dosya'),
        subtitle: [item.notes || item.category, item.size, item.uploadedBy].filter(Boolean).join(' • '),
      }
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
    case 'demirturk_collections_v2':
      return {
        department: 'Muhasebe',
        pageName: 'Tahsilatlar',
        title: String(item.customerName || item.title || 'Tahsilat Kaydı'),
        subtitle: [item.projectName, item.amount ? `${item.amount} ₺` : '', item.dueDate].filter(Boolean).join(' • '),
      }
    case 'demirturk_payments_v2':
      return {
        department: 'Muhasebe',
        pageName: 'Ödemeler',
        title: String(item.vendorName || item.title || item.description || 'Ödeme Kaydı'),
        subtitle: [item.category, item.amount ? `${item.amount} ₺` : '', item.date].filter(Boolean).join(' • '),
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
        subtitle: [item.category, item.assignedToName || item.serialNo].filter(Boolean).join(' • '),
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
        subtitle: [item.username ? `@${item.username}` : '', item.roleTitle || item.department].filter(Boolean).join(' • '),
      }
    case 'demirturk_google_ads_campaigns_v1':
      return {
        department: 'Pazarlama',
        pageName: 'Kampanyalar',
        title: String(item.name || 'Kampanya'),
        subtitle: [item.status, item.channelType].filter(Boolean).join(' • '),
      }
    default:
      return null
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

  restoreItem(trashId: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const list = readRawTrash()
    const target = list.find((x) => x.trashId === trashId)
    if (!target || !target.payload) return false

    try {
      // 1. Remove tombstone IDs from demirturk_deleted_ids_v1 first
      const rawDel = window.localStorage.getItem('demirturk_deleted_ids_v1')
      if (rawDel) {
        try {
          const delArr: string[] = JSON.parse(rawDel)
          if (Array.isArray(delArr)) {
            const cleanPhone = String(target.payload?.phone || '')
              .replace(/\D/g, '')
              .slice(-10)
            const phoneKey = cleanPhone.length >= 7 ? `phone:${cleanPhone}` : ''
            const nextDel = delArr.filter(
              (id) =>
                id !== target.itemId &&
                id !== target.itemKey &&
                (!phoneKey || id !== phoneKey)
            )
            window.localStorage.setItem('demirturk_deleted_ids_v1', JSON.stringify(nextDel))
          }
        } catch {}
      }

      // 2. Restore payload into original storeKey
      const rawStore = window.localStorage.getItem(target.storeKey)
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
          (target.storeKey === 'demirturk_users_v2' &&
            x?.username &&
            String(x.username).toLowerCase() === String(target.payload?.username || '').toLowerCase())
      )
      if (existsIdx >= 0) {
        storeArr[existsIdx] = restoredPayload
      } else {
        storeArr = [restoredPayload, ...storeArr]
      }
      window.localStorage.setItem(target.storeKey, JSON.stringify(storeArr))

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

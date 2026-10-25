import { AppUser } from './userStore'

export type PresenceStatusType =
  | 'OFISTE'
  | 'GOSTERIMDE'
  | 'TAPUDA'
  | 'SANTIYEDE'
  | 'TOPLANTIDA'
  | 'MOLADA'
  | 'IZINLI'
  | 'MESAI_DISI'

export interface PresenceStatusMeta {
  id: PresenceStatusType
  label: string
  shortLabel: string
  colorClass: string
  dotClass: string
  bgClass: string
  borderClass: string
  description: string
}

export const PRESENCE_STATUS_OPTIONS: PresenceStatusMeta[] = [
  {
    id: 'OFISTE',
    label: 'Ofiste',
    shortLabel: 'Ofiste',
    colorClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    bgClass: 'bg-emerald-500/12',
    borderClass: 'border-emerald-500/30',
    description: 'Merkez ofiste aktif çalışıyor',
  },
  {
    id: 'GOSTERIMDE',
    label: 'Gösterimde / Sahada',
    shortLabel: 'Gösterimde',
    colorClass: 'text-[#dfb76c]',
    dotClass: 'bg-[#dfb76c]',
    bgClass: 'bg-[#dfb76c]/12',
    borderClass: 'border-[#dfb76c]/30',
    description: 'Müşteriyle portföy veya daire gösteriminde',
  },
  {
    id: 'TAPUDA',
    label: 'Tapuda / Noterde',
    shortLabel: 'Tapuda',
    colorClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
    bgClass: 'bg-sky-500/12',
    borderClass: 'border-sky-500/30',
    description: 'Tapu müdürlüğü, noter veya belediye işleminde',
  },
  {
    id: 'SANTIYEDE',
    label: 'Şantiyede',
    shortLabel: 'Şantiyede',
    colorClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
    bgClass: 'bg-orange-500/12',
    borderClass: 'border-orange-500/30',
    description: 'Proje şantiye sahasında kontrol veya ziyarette',
  },
  {
    id: 'TOPLANTIDA',
    label: 'Toplantıda',
    shortLabel: 'Toplantıda',
    colorClass: 'text-purple-400',
    dotClass: 'bg-purple-400',
    bgClass: 'bg-purple-500/12',
    borderClass: 'border-purple-500/30',
    description: 'Müşteri sunumu veya ekip toplantısında',
  },
  {
    id: 'MOLADA',
    label: 'Molada / Yemekte',
    shortLabel: 'Molada',
    colorClass: 'text-amber-300',
    dotClass: 'bg-amber-300',
    bgClass: 'bg-amber-500/12',
    borderClass: 'border-amber-500/30',
    description: 'Öğle yemeği veya kısa molada',
  },
  {
    id: 'IZINLI',
    label: 'İzinli / Raporlu',
    shortLabel: 'İzinli',
    colorClass: 'text-rose-400',
    dotClass: 'bg-rose-400',
    bgClass: 'bg-rose-500/12',
    borderClass: 'border-rose-500/30',
    description: 'Günlük/saatlik izinde veya raporlu',
  },
  {
    id: 'MESAI_DISI',
    label: 'Mesai Dışı',
    shortLabel: 'Mesai Dışı',
    colorClass: 'text-[#8c857f]',
    dotClass: 'bg-[#8c857f]',
    bgClass: 'bg-white/5',
    borderClass: 'border-[#4a443f]',
    description: 'Aktif mesai saatleri dışında',
  },
]

export function getPresenceMeta(status?: PresenceStatusType): PresenceStatusMeta {
  return (
    PRESENCE_STATUS_OPTIONS.find((s) => s.id === status) || PRESENCE_STATUS_OPTIONS[0]
  )
}

export interface UserPresenceRecord {
  userId: string
  status: PresenceStatusType
  locationNote: string // Örn: "Vadi Konakları B Blok gösterimi", "Kadıköy Tapu"
  returnTime: string // Örn: "15:30"
  updatedAt: string
  updatedBy: string
}

export type SharedAssetCategory = 'ARAC' | 'PORTFOY_ANAHTARI' | 'EKIPMAN'

export interface SharedAssetItem {
  id: string
  name: string // Örn: "Şirket Aracı - Beyaz Megane", "Vadi Konakları Örnek Daire Anahtarı", "Lazer Metre"
  codeOrPlate: string // Örn: "34 DMR 01", "Dolap No: 4", "POS-1"
  category: SharedAssetCategory
  notes?: string
  holderUserId: string | null
  holderUserName: string | null
  takenAt: string | null
  destinationNote: string | null
  expectedReturnTime: string | null
  createdAt: string
}

export interface AssetHistoryLog {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  action: 'TESLIM_ALINDI' | 'TESLIM_EDILDI'
  userId: string
  userName: string
  destinationNote?: string
  expectedReturnTime?: string
  timestamp: string
}

export type LeaveType = 'SAATLIK_CIKIS' | 'YILLIK_IZIN' | 'MAZERET_IZNI' | 'RAPOR'
export type LeaveStatus = 'BEKLEMEDE' | 'ONAYLANDI' | 'REDDEDILDI'

export interface LeaveRequestItem {
  id: string
  userId: string
  userName: string
  userDepartment: string
  leaveType: LeaveType
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  startTime?: string // Saatlik çıkış için örn: "14:00"
  endTime?: string // Saatlik çıkış için örn: "16:30"
  reason: string
  status: LeaveStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  createdAt: string
}

const STORAGE_KEY_PRESENCE = 'demirturk_team_presence_v1'
const STORAGE_KEY_ASSETS = 'demirturk_team_assets_v1'
const STORAGE_KEY_ASSET_LOGS = 'demirturk_team_asset_logs_v1'
const STORAGE_KEY_LEAVES = 'demirturk_team_leaves_v1'

type Listener = () => void

class TeamOperationsStore {
  private presenceMap: Record<string, UserPresenceRecord> = {}
  private assets: SharedAssetItem[] = []
  private assetLogs: AssetHistoryLog[] = []
  private leaves: LeaveRequestItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return
    try {
      const pRaw = localStorage.getItem(STORAGE_KEY_PRESENCE)
      if (pRaw) this.presenceMap = JSON.parse(pRaw) || {}
    } catch {}
    try {
      const aRaw = localStorage.getItem(STORAGE_KEY_ASSETS)
      if (aRaw) {
        const parsed = JSON.parse(aRaw)
        if (Array.isArray(parsed)) this.assets = parsed
      }
    } catch {}
    try {
      const lRaw = localStorage.getItem(STORAGE_KEY_ASSET_LOGS)
      if (lRaw) {
        const parsed = JSON.parse(lRaw)
        if (Array.isArray(parsed)) this.assetLogs = parsed
      }
    } catch {}
    try {
      const lvRaw = localStorage.getItem(STORAGE_KEY_LEAVES)
      if (lvRaw) {
        const parsed = JSON.parse(lvRaw)
        if (Array.isArray(parsed)) this.leaves = parsed
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY_PRESENCE, JSON.stringify(this.presenceMap))
      localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(this.assets))
      localStorage.setItem(STORAGE_KEY_ASSET_LOGS, JSON.stringify(this.assetLogs))
      localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(this.leaves))
    } catch {}
    this.notify()
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  // ---------------------------------------------------------------------------
  // 1. CANLI DURUM ("KİM NEREDE?") YÖNETİMİ
  // ---------------------------------------------------------------------------
  public getUserPresence(userId: string): UserPresenceRecord {
    const existing = this.presenceMap[userId]
    if (existing) return existing
    return {
      userId,
      status: 'OFISTE',
      locationNote: '',
      returnTime: '',
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    }
  }

  public getAllPresenceMap(): Record<string, UserPresenceRecord> {
    return { ...this.presenceMap }
  }

  public updateUserPresence(
    userId: string,
    payload: {
      status: PresenceStatusType
      locationNote?: string
      returnTime?: string
      updatedBy?: string
    }
  ) {
    this.presenceMap[userId] = {
      userId,
      status: payload.status,
      locationNote: payload.locationNote ?? '',
      returnTime: payload.returnTime ?? '',
      updatedAt: new Date().toISOString(),
      updatedBy: payload.updatedBy || userId,
    }
    this.saveToStorage()
  }

  // ---------------------------------------------------------------------------
  // 2. ARAÇ ANAHTARI, PORTFÖY ANAHTARI & EKİPMAN ZİMMET YÖNETİMİ
  // ---------------------------------------------------------------------------
  public getAssets(): SharedAssetItem[] {
    return [...this.assets]
  }

  public getAssetsHeldByUser(userId: string): SharedAssetItem[] {
    return this.assets.filter((a) => a.holderUserId === userId)
  }

  public getAssetLogs(): AssetHistoryLog[] {
    return [...this.assetLogs]
  }

  public addAsset(input: {
    name: string
    codeOrPlate: string
    category: SharedAssetCategory
    notes?: string
  }): SharedAssetItem {
    const newItem: SharedAssetItem = {
      id: 'asset-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: input.name.trim(),
      codeOrPlate: input.codeOrPlate.trim(),
      category: input.category,
      notes: input.notes?.trim() || '',
      holderUserId: null,
      holderUserName: null,
      takenAt: null,
      destinationNote: null,
      expectedReturnTime: null,
      createdAt: new Date().toISOString(),
    }
    this.assets = [newItem, ...this.assets]
    this.saveToStorage()
    return newItem
  }

  public deleteAsset(assetId: string) {
    this.assets = this.assets.filter((a) => a.id !== assetId)
    this.saveToStorage()
  }

  public checkoutAsset(
    assetId: string,
    user: AppUser,
    options?: {
      destinationNote?: string
      expectedReturnTime?: string
      autoUpdatePresenceStatus?: PresenceStatusType
    }
  ) {
    const idx = this.assets.findIndex((a) => a.id === assetId)
    if (idx === -1) return

    const now = new Date().toISOString()
    const item = this.assets[idx]
    const updated: SharedAssetItem = {
      ...item,
      holderUserId: user.id,
      holderUserName: user.fullName,
      takenAt: now,
      destinationNote: options?.destinationNote?.trim() || null,
      expectedReturnTime: options?.expectedReturnTime?.trim() || null,
    }
    this.assets[idx] = updated

    const log: AssetHistoryLog = {
      id: 'alog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      assetId: item.id,
      assetName: item.name,
      assetCode: item.codeOrPlate,
      action: 'TESLIM_ALINDI',
      userId: user.id,
      userName: user.fullName,
      destinationNote: updated.destinationNote || undefined,
      expectedReturnTime: updated.expectedReturnTime || undefined,
      timestamp: now,
    }
    this.assetLogs = [log, ...this.assetLogs.slice(0, 99)]

    if (options?.autoUpdatePresenceStatus) {
      this.presenceMap[user.id] = {
        userId: user.id,
        status: options.autoUpdatePresenceStatus,
        locationNote:
          options.destinationNote?.trim() ||
          this.presenceMap[user.id]?.locationNote ||
          `${item.name} (${item.codeOrPlate}) ile sahada`,
        returnTime:
          options.expectedReturnTime?.trim() ||
          this.presenceMap[user.id]?.returnTime ||
          '',
        updatedAt: now,
        updatedBy: user.id,
      }
    }

    this.saveToStorage()
  }

  public returnAsset(assetId: string, returnedByUser?: AppUser | null) {
    const idx = this.assets.findIndex((a) => a.id === assetId)
    if (idx === -1) return

    const item = this.assets[idx]
    const now = new Date().toISOString()
    const actorName = returnedByUser?.fullName || item.holderUserName || 'Kullanıcı'
    const actorId = returnedByUser?.id || item.holderUserId || ''

    this.assets[idx] = {
      ...item,
      holderUserId: null,
      holderUserName: null,
      takenAt: null,
      destinationNote: null,
      expectedReturnTime: null,
    }

    const log: AssetHistoryLog = {
      id: 'alog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      assetId: item.id,
      assetName: item.name,
      assetCode: item.codeOrPlate,
      action: 'TESLIM_EDILDI',
      userId: actorId,
      userName: actorName,
      timestamp: now,
    }
    this.assetLogs = [log, ...this.assetLogs.slice(0, 99)]
    this.saveToStorage()
  }

  // ---------------------------------------------------------------------------
  // 3. İZİN & SAATLİK ÇIKIŞ TALEPLERİ YÖNETİMİ
  // ---------------------------------------------------------------------------
  public getLeaves(): LeaveRequestItem[] {
    return [...this.leaves]
  }

  public addLeaveRequest(input: {
    user: AppUser
    leaveType: LeaveType
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    reason: string
  }): LeaveRequestItem {
    const newReq: LeaveRequestItem = {
      id: 'leave-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId: input.user.id,
      userName: input.user.fullName,
      userDepartment: input.user.department,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate || input.startDate,
      startTime: input.startTime?.trim() || undefined,
      endTime: input.endTime?.trim() || undefined,
      reason: input.reason.trim(),
      status: 'BEKLEMEDE',
      createdAt: new Date().toISOString(),
    }
    this.leaves = [newReq, ...this.leaves]
    this.saveToStorage()
    return newReq
  }

  public decideLeaveRequest(
    leaveId: string,
    decision: 'ONAYLANDI' | 'REDDEDILDI',
    reviewer: AppUser,
    reviewNote?: string
  ) {
    const idx = this.leaves.findIndex((l) => l.id === leaveId)
    if (idx === -1) return

    const req = this.leaves[idx]
    const now = new Date().toISOString()
    this.leaves[idx] = {
      ...req,
      status: decision,
      reviewedBy: reviewer.fullName,
      reviewedAt: now,
      reviewNote: reviewNote?.trim() || undefined,
    }

    // Eğer izin onaylandıysa ve bugünü kapsıyorsa kişinin durumunu otomatik İzinli olarak güncelle
    const todayStr = new Date().toISOString().slice(0, 10)
    if (
      decision === 'ONAYLANDI' &&
      req.startDate <= todayStr &&
      req.endDate >= todayStr
    ) {
      this.presenceMap[req.userId] = {
        userId: req.userId,
        status: 'IZINLI',
        locationNote: req.reason,
        returnTime: req.endTime || '',
        updatedAt: now,
        updatedBy: reviewer.id,
      }
    }

    this.saveToStorage()
  }

  public deleteLeaveRequest(leaveId: string) {
    this.leaves = this.leaves.filter((l) => l.id !== leaveId)
    this.saveToStorage()
  }
}

export const teamOperationsStore = new TeamOperationsStore()

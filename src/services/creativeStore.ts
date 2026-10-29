export type ScheduleCategory =
  | 'OZEL_GUN'
  | 'RESMI_BAYRAM'
  | 'KAMPANYA'
  | 'CEKIM'
  | 'ICERIK'

export type SchedulePrepStatus =
  | 'PLANLANDI'
  | 'TASARIMDA'
  | 'ONAY_BEKLIYOR'
  | 'HAZIR'
  | 'YAYINLANDI'

export interface CreativeScheduleItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  category: ScheduleCategory
  status: SchedulePrepStatus
  project: string
  assignedTo: string
  channels: string[]
  notes: string
  isAnnualSpecialDay?: boolean
  createdAt: string
}

export type CreativeStatus =
  | 'TASLAK'
  | 'INCELEMEDE'
  | 'REVIZE'
  | 'ONAYLANDI'
  | 'YAYINDA'

export type CreativeFormat =
  | 'Reels / Video'
  | 'Story (9:16)'
  | 'Post / Kare (1:1)'
  | 'Karusel'
  | '3D Render'
  | 'Katalog / Broşür'
  | 'Billboard / Outdoor'

export interface CreativeAssetItem {
  id: string
  code: string
  title: string
  project: string
  format: CreativeFormat
  platform: string
  status: CreativeStatus
  designer: string
  dueDate: string
  version: string
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9'
  accentGradient: string
  previewImageUrl?: string
  headline: string
  adCopy: string
  ctaText: string
  specialDayTitle?: string
  createdAt: string
  updatedAt: string
}

export type CommentBadgeType = 'YORUM' | 'REVIZE' | 'ONAY'

export interface CreativeCommentItem {
  id: string
  creativeId: string
  creativeCode: string
  creativeTitle: string
  authorName: string
  authorDepartment: string
  content: string
  type: CommentBadgeType
  pinNote?: string
  isResolved: boolean
  createdAt: string
}

export type BriefPriority = 'ACIL' | 'YUKSEK' | 'NORMAL'
export type BriefStatus = 'YENI_BRIEF' | 'URETIMDE' | 'TESLIM_EDILDI'

export interface CreativeBriefItem {
  id: string
  title: string
  requestedBy: string
  requesterDepartment: string
  project: string
  format: CreativeFormat
  priority: BriefPriority
  deadline: string
  status: BriefStatus
  targetAudience: string
  keyMessage: string
  deliverables: string
  assignedDesigner: string
  createdAt: string
}

const STORAGE_KEY_SCHEDULE = 'demirturk_creative_schedule_v1'
const STORAGE_KEY_CREATIVES = 'demirturk_creatives_v1'
const STORAGE_KEY_COMMENTS = 'demirturk_creative_comments_v1'
const STORAGE_KEY_BRIEFS = 'demirturk_creative_briefs_v1'

const PURGED_MOCK_CREATIVE_IDS = new Set([
  'sch-29ekim',
  'sch-10kasim',
  'sch-kasim-kampanya',
  'sch-24kasim',
  'sch-yilbasi',
  'sch-sevgililer',
  'sch-8mart',
  'sch-23nisan',
  'sch-19mayis',
  'sch-30agustos',
  'crt-101',
  'crt-102',
  'crt-103',
  'crt-104',
  'crt-105',
  'crt-106',
  'cmt-1',
  'cmt-2',
  'cmt-3',
  'cmt-4',
  'brf-1',
  'brf-2',
  'brf-3',
])

type Listener = () => void

class CreativeStore {
  private schedule: CreativeScheduleItem[] = []
  private creatives: CreativeAssetItem[] = []
  private comments: CreativeCommentItem[] = []
  private briefs: CreativeBriefItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  private loadFromStorage() {
    try {
      const rawSchedule = localStorage.getItem(STORAGE_KEY_SCHEDULE)
      if (rawSchedule) {
        const parsed = JSON.parse(rawSchedule)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((x) => x && !PURGED_MOCK_CREATIVE_IDS.has(x.id))
          this.schedule = cleaned
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(cleaned))
          }
        }
      } else {
        this.schedule = []
      }

      const rawCreatives = localStorage.getItem(STORAGE_KEY_CREATIVES)
      if (rawCreatives) {
        const parsed = JSON.parse(rawCreatives)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((x) => x && !PURGED_MOCK_CREATIVE_IDS.has(x.id))
          this.creatives = cleaned
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_CREATIVES, JSON.stringify(cleaned))
          }
        }
      } else {
        this.creatives = []
      }

      const rawComments = localStorage.getItem(STORAGE_KEY_COMMENTS)
      if (rawComments) {
        const parsed = JSON.parse(rawComments)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (x) =>
              x &&
              !PURGED_MOCK_CREATIVE_IDS.has(x.id) &&
              !PURGED_MOCK_CREATIVE_IDS.has(x.creativeId)
          )
          this.comments = cleaned
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(cleaned))
          }
        }
      } else {
        this.comments = []
      }

      const rawBriefs = localStorage.getItem(STORAGE_KEY_BRIEFS)
      if (rawBriefs) {
        const parsed = JSON.parse(rawBriefs)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((x) => x && !PURGED_MOCK_CREATIVE_IDS.has(x.id))
          this.briefs = cleaned
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_BRIEFS, JSON.stringify(cleaned))
          }
        }
      } else {
        this.briefs = []
      }
    } catch (e) {
      console.error('Failed to load creativeStore:', e)
      this.schedule = []
      this.creatives = []
      this.comments = []
      this.briefs = []
    }
  }

  private saveSchedule() {
    try {
      localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(this.schedule))
    } catch {}
    this.notify()
  }

  private saveCreatives() {
    try {
      localStorage.setItem(STORAGE_KEY_CREATIVES, JSON.stringify(this.creatives))
    } catch {}
    this.notify()
  }

  private saveComments() {
    try {
      localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(this.comments))
    } catch {}
    this.notify()
  }

  private saveBriefs() {
    try {
      localStorage.setItem(STORAGE_KEY_BRIEFS, JSON.stringify(this.briefs))
    } catch {}
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  // --- SCHEDULE / SPECIAL DAYS ---
  getSchedule(): (CreativeScheduleItem & { daysLeft: number })[] {
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    return [...this.schedule]
      .map((item) => {
        const parts = item.date.split('-').map(Number)
        const target =
          parts.length === 3
            ? new Date(parts[0], parts[1] - 1, parts[2]).getTime()
            : new Date(item.date).getTime()
        const daysLeft = Math.round((target - todayMidnight) / (1000 * 60 * 60 * 24))
        return { ...item, daysLeft }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  addScheduleItem(
    data: Omit<CreativeScheduleItem, 'id' | 'createdAt'>
  ): CreativeScheduleItem {
    const newItem: CreativeScheduleItem = {
      ...data,
      id: 'sch-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    this.schedule.push(newItem)
    this.saveSchedule()
    return newItem
  }

  updateScheduleStatus(id: string, status: SchedulePrepStatus) {
    this.schedule = this.schedule.map((item) =>
      item.id === id ? { ...item, status } : item
    )
    this.saveSchedule()
  }

  deleteScheduleItem(id: string) {
    this.schedule = this.schedule.filter((item) => item.id !== id)
    this.saveSchedule()
  }

  // --- CREATIVES ---
  getCreatives(): CreativeAssetItem[] {
    return [...this.creatives].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  addCreative(
    data: Omit<CreativeAssetItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): CreativeAssetItem {
    const nextNum = 101 + this.creatives.length
    const nowIso = new Date().toISOString()
    const newItem: CreativeAssetItem = {
      ...data,
      id: 'crt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      code: `KRT-${nextNum}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    this.creatives.unshift(newItem)
    this.saveCreatives()
    return newItem
  }

  updateCreativeStatus(id: string, status: CreativeStatus) {
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, status, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  updateCreative(id: string, updates: Partial<CreativeAssetItem>) {
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  deleteCreative(id: string) {
    this.creatives = this.creatives.filter((c) => c.id !== id)
    this.comments = this.comments.filter((cm) => cm.creativeId !== id)
    this.saveCreatives()
    this.saveComments()
  }

  // --- COMMENTS ---
  getComments(creativeId?: string): CreativeCommentItem[] {
    const filtered = creativeId
      ? this.comments.filter((c) => c.creativeId === creativeId)
      : [...this.comments]
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  addComment(data: {
    creativeId: string
    authorName: string
    authorDepartment: string
    content: string
    type?: CommentBadgeType
    pinNote?: string
  }): CreativeCommentItem | null {
    const creative = this.creatives.find((c) => c.id === data.creativeId)
    if (!creative) return null

    const commentType: CommentBadgeType = data.type || 'YORUM'
    const newComment: CreativeCommentItem = {
      id: 'cmt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      creativeId: creative.id,
      creativeCode: creative.code,
      creativeTitle: creative.title,
      authorName: data.authorName,
      authorDepartment: data.authorDepartment,
      content: data.content.trim(),
      type: commentType,
      pinNote: data.pinNote?.trim() || undefined,
      isResolved: commentType === 'ONAY',
      createdAt: new Date().toISOString(),
    }

    this.comments.unshift(newComment)
    this.saveComments()

    if (commentType === 'REVIZE' && creative.status !== 'REVIZE') {
      this.updateCreativeStatus(creative.id, 'REVIZE')
    } else if (commentType === 'ONAY' && creative.status === 'INCELEMEDE') {
      this.updateCreativeStatus(creative.id, 'ONAYLANDI')
    }

    return newComment
  }

  toggleCommentResolved(commentId: string) {
    this.comments = this.comments.map((c) =>
      c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
    )
    this.saveComments()
  }

  // --- BRIEFS ---
  getBriefs(): CreativeBriefItem[] {
    return [...this.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  addBrief(
    data: Omit<CreativeBriefItem, 'id' | 'createdAt'>
  ): CreativeBriefItem {
    const newBrief: CreativeBriefItem = {
      ...data,
      id: 'brf-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    this.briefs.unshift(newBrief)
    this.saveBriefs()
    return newBrief
  }

  updateBriefStatus(id: string, status: BriefStatus) {
    this.briefs = this.briefs.map((b) => (b.id === id ? { ...b, status } : b))
    this.saveBriefs()
  }

  deleteBrief(id: string) {
    this.briefs = this.briefs.filter((b) => b.id !== id)
    this.saveBriefs()
  }
}

export const creativeStore = new CreativeStore()

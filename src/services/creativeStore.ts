import { userStore } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCrmServerCollection } from './crmServerCollection'
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
  private scheduleBackend = createCrmServerCollection<CreativeScheduleItem>('creative_schedule', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  private creativesBackend = createCrmServerCollection<CreativeAssetItem>('creative_assets', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  private commentsBackend = createCrmServerCollection<CreativeCommentItem>('creative_comments', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  private briefsBackend = createCrmServerCollection<CreativeBriefItem>('creative_briefs', () => { const user=userStore.getCurrentUser(),client=userStore.getServerClient(); return user&&client?{id:user.id,client}:null })
  public setAccount(id: string|null) { this.scheduleBackend.setAccount(id); this.schedule=[]; this.creativesBackend.setAccount(id); this.creatives=[]; this.commentsBackend.setAccount(id); this.comments=[]; this.briefsBackend.setAccount(id); this.briefs=[]; this.notify() }
  public async refreshFromBackend() { await Promise.all([this.scheduleBackend.refresh(),this.creativesBackend.refresh(),this.commentsBackend.refresh(),this.briefsBackend.refresh()]) }
  public getReadError() { return [this.scheduleBackend.getError(),this.creativesBackend.getError(),this.commentsBackend.getError(),this.briefsBackend.getError()].filter(Boolean).join(' · ') }

  private schedule: CreativeScheduleItem[] = []
  private creatives: CreativeAssetItem[] = []
  private comments: CreativeCommentItem[] = []
  private briefs: CreativeBriefItem[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
 this.scheduleBackend.subscribe(() => { if(isCentralCrm()) { this.schedule=this.scheduleBackend.getAll(); this.notify() } })
this.creativesBackend.subscribe(() => { if(isCentralCrm()) { this.creatives=this.creativesBackend.getAll(); this.notify() } })
this.commentsBackend.subscribe(() => { if(isCentralCrm()) { this.comments=this.commentsBackend.getAll(); this.notify() } })
this.briefsBackend.subscribe(() => { if(isCentralCrm()) { this.briefs=this.briefsBackend.getAll(); this.notify() } })
 if(isCentralCrm())return
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.loadFromStorage()
        this.notify()
      })
    }
  }

  private loadFromStorage() {
    if(isCentralCrm())return
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

  async addScheduleItem(
    data: Omit<CreativeScheduleItem, 'id' | 'createdAt'>
  ): Promise<CreativeScheduleItem> {
    const newItem: CreativeScheduleItem = {
      ...data,
      id: isCentralCrm()?crypto.randomUUID():'sch-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    if(isCentralCrm())return this.scheduleBackend.save(JSON.stringify(newItem),newItem)
    this.schedule.push(newItem)
    this.saveSchedule()
    return newItem
  }

  async updateScheduleStatus(id: string, status: SchedulePrepStatus) {
    if(isCentralCrm()) { const prior=this.schedule.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value={...prior,status}; await this.scheduleBackend.save(JSON.stringify([value,false]),value,false); return }
    this.schedule = this.schedule.map((item) =>
      item.id === id ? { ...item, status } : item
    )
    this.saveSchedule()
  }

  async deleteScheduleItem(id: string) {
    if(isCentralCrm()) { const prior=this.schedule.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value=prior; await this.scheduleBackend.save(JSON.stringify([value,true]),value,true); return }
    this.schedule = this.schedule.filter((item) => item.id !== id)
    this.saveSchedule()
  }

  // --- CREATIVES ---
  getCreatives(): CreativeAssetItem[] {
    return [...this.creatives].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async addCreative(
    data: Omit<CreativeAssetItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): Promise<CreativeAssetItem> {
    const nextNum = 101 + this.creatives.length
    const nowIso = new Date().toISOString()
    const newItem: CreativeAssetItem = {
      ...data,
      id: isCentralCrm()?crypto.randomUUID():'crt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      code: `KRT-${nextNum}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    if(isCentralCrm())return this.creativesBackend.save(JSON.stringify(newItem),newItem)
    this.creatives.unshift(newItem)
    this.saveCreatives()
    return newItem
  }

  async updateCreativeStatus(id: string, status: CreativeStatus) {
    if(isCentralCrm()) { const prior=this.creatives.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value={...prior,status}; await this.creativesBackend.save(JSON.stringify([value,false]),value,false); return }
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, status, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  async updateCreative(id: string, updates: Partial<CreativeAssetItem>) {
    if(isCentralCrm()) { const prior=this.creatives.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value={...prior,...updates,id}; await this.creativesBackend.save(JSON.stringify([value,false]),value,false); return }
    const nowIso = new Date().toISOString()
    this.creatives = this.creatives.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: nowIso } : c
    )
    this.saveCreatives()
  }

  async deleteCreative(id: string) {
    if(isCentralCrm()) { const prior=this.creatives.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value=prior; await this.creativesBackend.save(JSON.stringify([value,true]),value,true); return }
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

  async addComment(data: {
    creativeId: string
    authorName: string
    authorDepartment: string
    content: string
    type?: CommentBadgeType
    pinNote?: string
  }): Promise<CreativeCommentItem | null> {
    const creative = this.creatives.find((c) => c.id === data.creativeId)
    if (!creative) return null

    const commentType: CommentBadgeType = data.type || 'YORUM'
    const newComment: CreativeCommentItem = {
      id: isCentralCrm()?crypto.randomUUID():'cmt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
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

    if(isCentralCrm()) { const result=await this.commentsBackend.save(JSON.stringify(newComment),newComment); await this.creativesBackend.refresh(); return result }
    this.comments.unshift(newComment)
    this.saveComments()

    if (commentType === 'REVIZE' && creative.status !== 'REVIZE') {
      this.updateCreativeStatus(creative.id, 'REVIZE')
    } else if (commentType === 'ONAY' && creative.status === 'INCELEMEDE') {
      this.updateCreativeStatus(creative.id, 'ONAYLANDI')
    }

    return newComment
  }

  async toggleCommentResolved(commentId: string) {
    if(isCentralCrm()) { const prior=this.comments.find(row=>row.id===commentId); if(!prior)throw Error('Kayıt bulunamadı.'); const value={...prior,isResolved:!prior.isResolved}; await this.commentsBackend.save(JSON.stringify([value,false]),value,false); return }
    this.comments = this.comments.map((c) =>
      c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
    )
    this.saveComments()
  }

  // --- BRIEFS ---
  getBriefs(): CreativeBriefItem[] {
    return [...this.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async addBrief(
    data: Omit<CreativeBriefItem, 'id' | 'createdAt'>
  ): Promise<CreativeBriefItem> {
    const newBrief: CreativeBriefItem = {
      ...data,
      id: isCentralCrm()?crypto.randomUUID():'brf-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }
    if(isCentralCrm())return this.briefsBackend.save(JSON.stringify(newBrief),newBrief)
    this.briefs.unshift(newBrief)
    this.saveBriefs()
    return newBrief
  }

  async updateBriefStatus(id: string, status: BriefStatus) {
    if(isCentralCrm()) { const prior=this.briefs.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value={...prior,status}; await this.briefsBackend.save(JSON.stringify([value,false]),value,false); return }
    this.briefs = this.briefs.map((b) => (b.id === id ? { ...b, status } : b))
    this.saveBriefs()
  }

  async deleteBrief(id: string) {
    if(isCentralCrm()) { const prior=this.briefs.find(row=>row.id===id); if(!prior)throw Error('Kayıt bulunamadı.'); const value=prior; await this.briefsBackend.save(JSON.stringify([value,true]),value,true); return }
    this.briefs = this.briefs.filter((b) => b.id !== id)
    this.saveBriefs()
  }
}

export const creativeStore = new CreativeStore()

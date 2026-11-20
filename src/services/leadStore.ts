import {
  Lead,
  CallCenterStatus,
  CALL_STATUS_OPTIONS,
  LeadActivity,
  LeadStage,
  CustomerInquiry,
  AssignmentHistoryEntry,
  StageHistoryEntry,
  AiEvaluation,
  LeadMetaCapiStatus,
} from '@/types/lead'
import { MetaCapiEventName } from '@/types/meta'
import { AppUser, userStore } from './userStore'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToLead, rowToActivity } from './dbMapper'
import { metaStore } from './metaStore'
import { normalizePhone } from '../../supabase/functions/_shared/meta-core'

import { playNewLeadChime } from '@/utils/audioAlert'
import { formatSentenceNote } from '@/utils/formatters'
import { trashStore } from './trashStore'
import { createManualLead } from './manualLeadRepository'
import { createLeadArchiveRepository, LeadArchiveError } from './leadArchiveRepository'
import { isWebsiteRecord, allowManualWebsiteDelete } from './zeroStatePurge'

const STORAGE_KEY_LEADS = 'demirturk_leads_v2'
const STORAGE_KEY_ACTIVITIES = 'demirturk_activities_v2'
const STORAGE_KEY_LAST_ASSIGNED_MT = 'demirturk_last_assigned_mt_idx'
const STORAGE_KEY_COMPANY_LEAD_SEQ = 'demirturk_company_lead_seq_v1'
const STORAGE_KEY_COMPANY_LEAD_MAP = 'demirturk_company_lead_map_v1'

type Listener = () => void
type LeadWorkChange = Partial<Pick<Lead, 'notes' | 'callStatus' | 'stage' | 'isQualified'>>
  & { assignedToUserId?: string | null; salesTarget?: string | null; salesNote?: string;
    fullName?: string; phone?: string; secondaryPhone?: string | null; whatsappPhone?: string | null;
    email?: string | null; budget?: number | null; preferredHousingType?: string | null }

function cleanPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/[^\d+]/g, '').trim()
}

class LeadStore {
  public ackMetaStage(id: string, revision: number, updatedAt: string, stage: LeadStage) {
    this.leads = this.leads.map(l => l.id === id ? { ...l, metaRevision: revision,
      ...(l.stage === stage ? { updatedAt } : {}) } : l)
    this.saveToStorage()
  }
  public acceptMetaServerLead(incoming: Lead) {
    // Central screens only accept the RLS-filtered feed, including archive and ownership rules.
    if (userStore.centralAuthEnabled) return
    const current = this.leads.find(l => l.id === incoming.id)
    // Yerel daha yeni değişiklikleri körlemesine ezmeyin; çakışma kullanıcıya yansıtılır.
    if (current && Date.parse(current.updatedAt) > Date.parse(incoming.updatedAt)) {
      throw new Error('Yerel müşteri değişikliği sunucu kaydından yeni. Eşitleme çakışması çözülmeden veri üzerine yazılmadı.')
    }
    metaStore.resetStageWrite(incoming.id)
    this.leads = [...this.leads.filter(l => l.id !== incoming.id), incoming]
    this.saveToStorage()
    this.notify()
  }
  private leads: Lead[] = []
  private activities: Record<string, LeadActivity[]> = {}
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null
  private pollInterval: any = null
  private centralReadError = ''
  private centralWriteError = ''
  private centralWrites = new Map<string, string>()
  private pendingWork = new Map<string, { requestId: string; key: string; expected: string }>()
  private centralRefresh: (() => Promise<number>) | null = null
  private centralFeedGeneration = 0
  private centralManualWriteVersion = 0
  private pendingTransfers = new Map<string, { requestId: string; targetId: string; expected: string }>()
  private pendingArchive: { ids: string[]; records: { id: string; expected: string }[]; requestId: string } | null = null
  private archiving = false

  constructor() {
    if (userStore.centralAuthEnabled) return
    this.loadFromStorage()
    this.initRealtime()
    this.initFastPolling()
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        const prevIds = new Set(this.leads.map((l) => l.id))
        this.reloadFromCloudMirror()
        const newLeads = this.leads.filter((l) => !prevIds.has(l.id))
        if (newLeads.length === 1) {
          this.triggerNewLeadAlert(newLeads[0])
        } else if (newLeads.length > 1) {
          this.triggerBulkLeadAlert(newLeads)
        }
        this.notify()
      })
    }
  }

  private reloadFromCloudMirror() {
    try {
      const savedLeads = localStorage.getItem(STORAGE_KEY_LEADS)
      const savedActivities = localStorage.getItem(STORAGE_KEY_ACTIVITIES)
      if (savedLeads) {
        const parsed = JSON.parse(savedLeads)
        if (Array.isArray(parsed)) {
          this.leads = parsed
        }
      }
      if (savedActivities) {
        const parsedAct = JSON.parse(savedActivities)
        if (parsedAct && typeof parsedAct === 'object') {
          this.activities = parsedAct
        }
      }
      this.repairMetaCsvLeads()
      this.ensureSequentialNumbersForLeads()
    } catch {}
  }

  private getCompanyKey(companyName?: string): string {
    const raw = (companyName || userStore.getCurrentUser()?.companyName || 'Demirtürk İnşaat').trim()
    return raw.toLocaleLowerCase('tr-TR').replace(/\s+/g, '_') || 'default_company'
  }

  private loadSeqStore(): Record<string, number> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANY_LEAD_SEQ)
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  private saveSeqStore(store: Record<string, number>): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMPANY_LEAD_SEQ, JSON.stringify(store))
    } catch {}
  }

  private loadLeadNumberMap(): Record<string, Record<string, number>> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANY_LEAD_MAP)
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  private saveLeadNumberMap(map: Record<string, Record<string, number>>): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMPANY_LEAD_MAP, JSON.stringify(map))
    } catch {}
  }

  /**
   * Şirket bazlı 1'den başlayan ve kayıt silinse bile asla geri çekilmeyen
   * ardışık lead numarası (#lead-1, #lead-2, ...) üretir veya mevcut kaydın numarasını döner.
   */
  public allocateLeadNumber(companyName?: string, existingLeadId?: string): number {
    const companyKey = this.getCompanyKey(companyName)
    const seqStore = this.loadSeqStore()
    const mapStore = this.loadLeadNumberMap()
    if (!mapStore[companyKey]) {
      mapStore[companyKey] = {}
    }
    const companyMap = mapStore[companyKey]

    if (existingLeadId && typeof companyMap[existingLeadId] === 'number' && companyMap[existingLeadId] > 0) {
      const existingNum = companyMap[existingLeadId]
      if ((seqStore[companyKey] || 0) < existingNum) {
        seqStore[companyKey] = existingNum
        this.saveSeqStore(seqStore)
      }
      return existingNum
    }

    // Eğer ID zaten "lead-1", "lead-2" gibi ardışık kısa numara formatındaysa (timestamp değilse)
    if (existingLeadId) {
      const shortMatch = existingLeadId.match(/^lead-(\d{1,6})$/)
      if (shortMatch) {
        const parsedNum = parseInt(shortMatch[1], 10)
        const alreadyUsedByOther = Object.entries(companyMap).some(
          ([k, v]) => k !== existingLeadId && v === parsedNum
        )
        if (parsedNum > 0 && !alreadyUsedByOther) {
          companyMap[existingLeadId] = parsedNum
          seqStore[companyKey] = Math.max(seqStore[companyKey] || 0, parsedNum)
          this.saveLeadNumberMap(mapStore)
          this.saveSeqStore(seqStore)
          return parsedNum
        }
      }
    }

    const currentMax = seqStore[companyKey] || 0
    const highestInMap = Object.values(companyMap).reduce((max, n) => (n > max ? n : max), 0)
    const nextNum = Math.max(currentMax, highestInMap) + 1

    seqStore[companyKey] = nextNum
    if (existingLeadId) {
      companyMap[existingLeadId] = nextNum
      this.saveLeadNumberMap(mapStore)
    }
    this.saveSeqStore(seqStore)
    return nextNum
  }

  /**
   * Mevcut veya dışarıdan (Meta Ads, Web, Supabase) gelen tüm lead'lere
   * oluşturulma sırasına (createdAt) göre şirket bazlı ardışık numara (#lead-1, #lead-2...) atar.
   */

  private getDeletedIdsSet(): Set<string> {
    try {
      const raw = localStorage.getItem('demirturk_deleted_ids_v1')
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) {
        return new Set(arr.filter((x) => typeof x === 'string'))
      }
    } catch {}
    return new Set()
  }

  private addDeletedIds(ids: string[]): void {
    try {
      const set = this.getDeletedIdsSet()
      let changed = false
      for (const id of ids) {
        if (id && !set.has(id)) {
          set.add(id)
          changed = true
        }
      }
      if (changed) {
        localStorage.setItem('demirturk_deleted_ids_v1', JSON.stringify(Array.from(set)))
      }
    } catch {}
  }

  private repairMetaCsvLeads(): void {
    const deletedIds = this.getDeletedIdsSet()
    if (!this.leads) this.leads = []
    if (deletedIds.size > 0) {
      this.leads = this.leads.filter((l) => !deletedIds.has(l.id))
    }
    if (this.leads.length === 0) return
    const metaSkipQuestions = new Set([
      'oluşturuldu',
      'olusturuldu',
      'adı',
      'adi',
      'ad',
      'ad soyad',
      'isim',
      'full_name',
      'kaynak',
      'kanal',
      'aşama',
      'asama',
      'sahibi',
    ])
    this.leads = this.leads.map((l) => {
      if (!Array.isArray(l.metaAnswers) || l.metaAnswers.length === 0) return l
      let updatedFullName = l.fullName
      let updatedCreatedAt = l.createdAt

      for (const ans of l.metaAnswers) {
        const q = String(ans?.question || '').toLowerCase().trim()
        const val = String(ans?.answer || '').trim()
        if (!val) continue
        if (
          (q === 'adı' || q === 'adi' || q === 'ad' || q === 'ad soyad' || q === 'isim' || q === 'full_name') &&
          (!updatedFullName || updatedFullName === 'Meta Müşterisi' || updatedFullName === 'Meta Müşteri Adayı')
        ) {
          updatedFullName = val
        } else if (q.includes('oluşturul') || q.includes('olusturul') || q.includes('created') || q === 'tarih') {
          const cleaned = val.replace(/(\d)(am|pm)$/i, '$1 $2')
          const d = new Date(cleaned)
          if (!isNaN(d.getTime())) {
            updatedCreatedAt = d.toISOString()
          }
        }
      }

      const cleanedAnswers = l.metaAnswers.filter((ans) => {
        const q = String(ans?.question || '').toLowerCase().trim()
        return !metaSkipQuestions.has(q)
      })

      return {
        ...l,
        fullName: updatedFullName,
        createdAt: updatedCreatedAt,
        metaAnswers: cleanedAnswers,
      }
    })
  }

  private ensureSequentialNumbersForLeads(): void {
    if (!this.leads || this.leads.length === 0) return

    // Numarası henüz atanmamış olanlara kronolojik sırayla (eskiden yeniye) numara ver
    const chronological = [...this.leads].sort((a, b) => {
      const tA = new Date(a.createdAt).getTime() || 0
      const tB = new Date(b.createdAt).getTime() || 0
      return tA - tB
    })

    const assignedById = new Map<string, number>()
    const usedNumbers = new Set<number>()
    for (const l of chronological) {
      let num: number
      if (l.leadNumber && l.leadNumber > 0 && !usedNumbers.has(l.leadNumber)) {
        num = this.registerKnownLeadNumber(l.companyName, l.id, l.leadNumber)
      } else {
        num = this.allocateLeadNumber(l.companyName, l.id)
        while (usedNumbers.has(num)) {
          num = this.registerKnownLeadNumber(l.companyName, l.id, num + 1)
        }
      }
      usedNumbers.add(num)
      assignedById.set(l.id, num)
    }

    this.leads = this.leads.map((l) => ({
      ...l,
      companyName: l.companyName || userStore.getCurrentUser()?.companyName || 'Demirtürk İnşaat',
      leadNumber: assignedById.get(l.id) || l.leadNumber || 1,
    }))
  }

  private registerKnownLeadNumber(companyName: string | undefined, leadId: string, num: number): number {
    const companyKey = this.getCompanyKey(companyName)
    const seqStore = this.loadSeqStore()
    const mapStore = this.loadLeadNumberMap()
    if (!mapStore[companyKey]) {
      mapStore[companyKey] = {}
    }
    mapStore[companyKey][leadId] = num
    if ((seqStore[companyKey] || 0) < num) {
      seqStore[companyKey] = num
      this.saveSeqStore(seqStore)
    }
    this.saveLeadNumberMap(mapStore)
    return num
  }

  /**
   * Lead'in kullanıcıya gösterilen ardışık kayıt numarasını (#lead-1, #lead-2 vb.) döner.
   */
  public getLeadDisplayCode(lead: Lead): string {
    const num = lead.leadNumber && lead.leadNumber > 0
      ? lead.leadNumber
      : this.allocateLeadNumber(lead.companyName, lead.id)
    return `#lead-${num}`
  }

  public setLoadedLeads(leads: Lead[], activities: Record<string, LeadActivity[]>) {
    const deletedIds = this.getDeletedIdsSet()
    // Merge loaded leads while preserving any local leads (excluding deleted IDs)
    const currentMap = new Map(
      this.leads.filter((l) => !deletedIds.has(l.id)).map((l) => [l.id, l])
    )
    const merged = [...(leads || [])].filter((l) => !deletedIds.has(l.id))

    // Keep any leads that exist locally but were not in the snapshot
    for (const [id, lead] of currentMap) {
      if (deletedIds.has(id)) continue
      if (!merged.some((m) => m.id === id)) {
        merged.unshift(lead)
        syncService.saveLead(lead)
      }
    }

    // Merge activities per lead without losing local activities
    const mergedActivities: Record<string, LeadActivity[]> = { ...this.activities }
    if (activities && typeof activities === 'object') {
      for (const [leadId, incomingActs] of Object.entries(activities)) {
        const localActs = mergedActivities[leadId] || []
        const byId = new Map<string, LeadActivity>()
        for (const a of incomingActs || []) byId.set(a.id, a)
        for (const la of localActs) {
          if (!byId.has(la.id)) {
            byId.set(la.id, la)
            syncService.saveActivity(la)
          }
        }
        mergedActivities[leadId] = Array.from(byId.values())
      }
    }

    this.leads = merged
    this.activities = mergedActivities
    this.repairMetaCsvLeads()
    this.ensureSequentialNumbersForLeads()
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(this.leads))
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(this.activities))
    } catch {}
    this.notify()
  }

  private triggerBulkLeadAlert(leads: Lead[]) {
    if (!leads || leads.length === 0) return
    playNewLeadChime()
    if (typeof window !== "undefined") {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`${leads.length} yeni potansiyel müşteri eklendi`, {
            body: "Toplu müşteri aktarımı başarıyla tamamlandı.",
            icon: "/icon.png",
          })
        } catch {}
      }
    }
  }

  public flushSave() {
    this.saveToStorage()
  }

  private triggerNewLeadAlert(lead: Lead) {
    // 1. Play subtle luxury chime sound
    playNewLeadChime()

    // 2. Dispatch custom in-app event for floating toast banner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('demirturk:new-lead', { detail: lead }))

      // 3. Desktop / OS Native notification if app is in background
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`Yeni Müşteri: ${lead.fullName}`, {
            body: `${lead.phone} • ${lead.formName || 'Meta Ads Formu'}\nTalep: ${lead.preferredHousingType || 'Konut'}`,
            icon: '/icon.png',
          })
        } catch {}
      }
    }
  }

  private initRealtime() {
    if (!isSupabaseConfigured() || this.realtimeChannel) return

    this.realtimeChannel = supabase
      .channel('realtime:leads-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = rowToLead(payload.new)
          incoming.leadNumber = this.allocateLeadNumber(incoming.companyName, incoming.id)
          const existingIdx = this.leads.findIndex((l) => l.id === incoming.id)
          if (existingIdx !== -1) {
            this.leads[existingIdx] = incoming
          } else {
            this.leads = [incoming, ...this.leads]
            this.triggerNewLeadAlert(incoming)
          }
          this.saveToStorage(false)
        } else if (payload.eventType === 'UPDATE') {
          const incoming = rowToLead(payload.new)
          incoming.leadNumber = this.allocateLeadNumber(incoming.companyName, incoming.id)
          const idx = this.leads.findIndex((l) => l.id === incoming.id)
          if (idx !== -1) {
            this.leads[idx] = incoming
          } else {
            this.leads = [incoming, ...this.leads]
          }
          this.saveToStorage(false)
        } else if (payload.eventType === 'DELETE') {
          this.leads = this.leads.filter((l) => l.id !== (payload.old as any).id)
          this.saveToStorage(false)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const act = rowToActivity(payload.new)
          const existing = this.activities[act.leadId] || []
          if (!existing.some((a) => a.id === act.id)) {
            this.activities[act.leadId] = [...existing, act]
            this.saveToStorage(false)
          }
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[Supabase Realtime] Reconnecting leads channel in 3s...', status, err)
          setTimeout(() => {
            if (this.realtimeChannel) {
              try { supabase.removeChannel(this.realtimeChannel) } catch {}
              this.realtimeChannel = null
              this.initRealtime()
            }
          }, 3000)
        }
      })
  }

  // Fast background polling backup (every 10s) ensuring zero missed leads even if PC slept or network glitched
  private initFastPolling() {
    if (this.pollInterval || typeof window === 'undefined') return
    this.pollInterval = window.setInterval(async () => {
      try {
        if (!isSupabaseConfigured() || document.hidden) return
        const { data: latestLeads, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(15)

        if (error || !latestLeads || latestLeads.length === 0) return

        let hasNew = false
        const deletedIds = this.getDeletedIdsSet()
        for (const raw of latestLeads) {
          const mapped = rowToLead(raw)
          if (deletedIds.has(mapped.id)) continue
          if (!this.leads.some((l) => l.id === mapped.id)) {
            mapped.leadNumber = this.allocateLeadNumber(mapped.companyName, mapped.id)
            this.leads.unshift(mapped)
            hasNew = true
            this.triggerNewLeadAlert(mapped)
          }
        }

        if (hasNew) {
          this.saveToStorage(false)
        }
      } catch {}
    }, 10000)
  }

  private loadFromStorage() {
    try {
      const savedLeads = localStorage.getItem(STORAGE_KEY_LEADS)
      const savedActivities = localStorage.getItem(STORAGE_KEY_ACTIVITIES)
      this.leads = savedLeads ? JSON.parse(savedLeads) : []
      this.activities = savedActivities ? JSON.parse(savedActivities) : {}
    } catch {
      this.leads = []
      this.activities = {}
    }

    const fakeDanismanNames = new Set(['Selin Yılmaz', 'Can Özdemir', 'Mert Demir', 'Berkant Çalışkan'])

    this.leads = this.leads.map((l) => {
      if (l.assignedToUserName && fakeDanismanNames.has(l.assignedToUserName)) {
        return {
          ...l,
          assignedToUserId: undefined,
          assignedToUserName: undefined,
          owner: 'Atanmamış',
        }
      }
      return l
    })

    this.repairMetaCsvLeads()
    this.ensureSequentialNumbersForLeads()

    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(this.leads))
    } catch {}
  }

  private saveToStorage(_syncCloud = true) {
    if (userStore.centralAuthEnabled) {
      this.notify()
      return
    }
    this.ensureSequentialNumbersForLeads()
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(this.leads))
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(this.activities))
    } catch (e) {
      console.error('Storage save error:', e)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getReadError() {
    return this.centralWriteError || this.centralReadError
  }

  private async saveCentralLeadWork(id: string, change: LeadWorkChange | { timelineNote: string }): Promise<boolean> {
    const account = userStore.getCurrentUser()?.id
    const client = userStore.getServerClient()
    const lead = this.getById(id)
    if (!account || !client || !lead) return false
    if (this.centralWrites.has(id)) {
      this.centralWriteError = 'Bu müşteri için önceki işlem sürüyor.'
      this.notify()
      return false
    }

    const key = JSON.stringify(change)
    let pendingWork = this.pendingWork.get(id)
    if (pendingWork && pendingWork.key !== key) {
      this.centralWriteError = 'Önceki değişikliği aynı bilgilerle yeniden doğrulayın.'
      this.notify()
      return false
    }
    pendingWork ??= { requestId: crypto.randomUUID(), key, expected: lead.updatedAt }
    this.pendingWork.set(id, pendingWork)
    const requestId = pendingWork.requestId
    this.centralWrites.set(id, requestId)
    const isCurrent = () => userStore.getCurrentUser()?.id === account && this.centralWrites.get(id) === requestId
    try {
      const timelineNote = 'timelineNote' in change
      const operation = timelineNote
        ? client.rpc('crm_add_lead_note', { p_request: requestId, p_id: id, p_note: change.timelineNote })
        : client.rpc('crm_update_lead_work', {
          p_request: requestId, p_id: id, p_expected: pendingWork.expected, p_change: change,
        })
      const { data, error } = await operation.abortSignal(AbortSignal.timeout(15000))
      if (!isCurrent()) return false
      if (error || (timelineNote ? data !== 'crm-note-' + requestId : data?.id !== id)) {
        if (error && ['40001', '42501', '22023'].includes(error.code)) this.pendingWork.delete(id)
        this.centralWriteError = error?.code === '40001'
          ? 'Müşteri kaydı başka bir işlemle değişti. Güncel kaydı açıp tekrar deneyin.'
          : 'Müşteri değişikliği sunucuda doğrulanamadı. Yetkiyi ve güncel kaydı kontrol edin.'
        void this.centralRefresh?.()
        return false
      }
      if (!timelineNote) {
        this.centralManualWriteVersion++
        const updated = data.updated_at ? rowToLead(data) : undefined
        this.leads = this.leads.filter(item => item.id !== id)
        if (updated) this.leads.push(updated)
        else delete this.activities[id]
      }
      this.centralWriteError = ''
      this.pendingWork.delete(id)
      void this.centralRefresh?.()
      return true
    } catch {
      if (isCurrent()) {
        this.centralWriteError = 'Sunucudan yazım onayı alınamadı. Güncel kaydı tekrar kontrol edin.'
        void this.centralRefresh?.()
      }
      return false
    } finally {
      if (isCurrent()) {
        this.centralWrites.delete(id)
        this.notify()
      }
    }
  }

  public connectCentralFeed(accountId: string) {
    const client = userStore.getServerClient()
    if (!client || userStore.getCurrentUser()?.id !== accountId) return

    const lifetime = new AbortController()
    const isCurrent = () => !lifetime.signal.aborted && userStore.getCurrentUser()?.id === accountId
    let pending: Promise<number> | undefined
    let changedDuringRead = false
    let loaded = false

    const readTable = async (table: 'leads' | 'lead_activities') => {
      const rows: Record<string, unknown>[] = []
      let after: string | undefined
      while (true) {
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)])
        let query = client.from(table).select('*').order('id', { ascending: true }).limit(100)
        if (after !== undefined) query = query.gt('id', after)
        const { data, error } = await query.abortSignal(signal)
        if (error || !data || !isCurrent()) throw new Error('Müşteri kayıtları okunamadı.')
        rows.push(...data)
        if (data.length < 100) return rows
        const last = data.at(-1)?.id
        if (typeof last !== 'string' || last === after) throw new Error('Müşteri listesi doğrulanamadı.')
        after = last
      }
    }

    const refresh = (): Promise<number> => {
      if (!isCurrent()) return Promise.resolve(0)
      if (pending) {
        changedDuringRead = true
        return pending
      }
      pending = (async () => {
        const writeVersion = this.centralManualWriteVersion
        try {
          const [rows, activityRows] = await Promise.all([readTable('leads'), readTable('lead_activities')])
          if (!isCurrent()) return 0
          if (writeVersion !== this.centralManualWriteVersion) {
            changedDuringRead = true
            return this.leads.length
          }
          const previousIds = new Set(this.leads.map(lead => lead.id))
          this.leads = rows.map(rowToLead)
          this.activities = Object.create(null)
          const activities = activityRows.map(rowToActivity).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          for (const activity of activities) {
            ;(this.activities[activity.leadId] ??= []).push(activity)
          }
          this.centralReadError = ''
          const arrivals = loaded ? this.leads.filter(lead => !previousIds.has(lead.id)) : []
          loaded = true
          if (arrivals.length === 1) this.triggerNewLeadAlert(arrivals[0])
          if (arrivals.length > 1) this.triggerBulkLeadAlert(arrivals)
          this.notify()
          return this.leads.length
        } catch {
          if (isCurrent()) {
            this.centralReadError = 'Müşteri kayıtları sunucudan yenilenemedi.'
            this.notify()
          }
          return 0
        }
      })().finally(() => {
        pending = undefined
        if (changedDuringRead) {
          changedDuringRead = false
          void refresh()
        }
      })
      return pending
    }

    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    this.centralRefresh = refresh
    void refresh()
    const channel = client.channel('crm-leads:' + ++this.centralFeedGeneration)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities' }, () => void refresh())
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void refresh()
      })
    const interval = window.setInterval(refreshVisible, 2000)
    window.addEventListener('online', refreshVisible)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      lifetime.abort()
      window.clearInterval(interval)
      window.removeEventListener('online', refreshVisible)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      void client.removeChannel(channel)
      this.centralRefresh = null
      this.centralReadError = ''
      this.centralWriteError = ''
      this.centralWrites.clear()
      this.pendingWork.clear()
      this.pendingTransfers.clear()
      this.pendingArchive = null
      this.leads = []
      this.activities = {}
      this.notify()
    }
  }

  /**
   * Directly refresh all leads from Supabase cloud database
   */
  public async refreshFromSupabase(): Promise<number> {
    if (userStore.centralAuthEnabled) return this.centralRefresh?.() ?? 0
    if (!isSupabaseConfigured()) return 0
    try {
      const { data: dbLeads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !dbLeads) return 0

      const mappedLeads = dbLeads.map(rowToLead)
      this.setLoadedLeads(mappedLeads, this.activities)
      return mappedLeads.length
    } catch (e) {
      console.error('[LeadStore] refreshFromSupabase error:', e)
      return 0
    }
  }

  /**
   * Manuel Verileri Al (Artımlı / Incremental Sync):
   * Yerel mağazada en son kaydedilmiş lead'in createdAt tarihinden sonra oluşturulmuş
   * yeni lead verilerini Supabase'den sorgular, ekler ve yeni gelen sayısını döner.
   */
  public async pullLatestLeads(options?: {
    startDate?: Date
    endDate?: Date
    onProgress?: (message:string)=>void
  }): Promise<{
    newCount: number
    updatedCount: number
    latestTime?: string
    needsPageToken?: boolean
    error?: string
  }> {
    const endDate = options?.endDate || new Date()
    let startDate = options?.startDate
    const pullingAccount = userStore.getCurrentUser()?.id
    if (userStore.centralAuthEnabled) {
      try {
        options?.onProgress?.('Sunucu ve Meta okuma bağlantısı doğrulanıyor…')
        const connection = await metaStore.testConnection()
        if (!connection.success) throw Error(connection.error || 'Meta okuma bağlantısı doğrulanamadı.')
        const client = userStore.getServerClient()
        if (!client || !pullingAccount || pullingAccount !== userStore.getCurrentUser()?.id) throw Error('Uygulama oturumu değişti. Yeniden deneyin.')
        if (!startDate) {
          const { data, error } = await client.from('leads').select('created_at')
            .or('meta_lead_id.not.is.null,source.in.(META_ADS,FACEBOOK,INSTAGRAM)')
            .lte('created_at', endDate.toISOString()).order('created_at', { ascending: false }).limit(1)
            .abortSignal(AbortSignal.timeout(15000))
          if (error || !Array.isArray(data)) throw Error('Son Meta kaydının tarihi sunucudan okunamadı. Yeniden deneyin.')
          const latest = data[0]?.created_at ? Date.parse(data[0].created_at) : NaN
          // A short overlap makes boundary deliveries safe; source IDs prevent duplicates.
          startDate = Number.isFinite(latest) ? new Date(latest - 60000) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
          options?.onProgress?.(Number.isFinite(latest) ? 'Sunucudaki son Meta kaydından itibaren alınıyor…' : 'İlk alım: son 7 gün kontrol ediliyor…')
        }
      } catch (error) { return { newCount: 0, updatedCount: 0, error: error instanceof Error ? error.message : 'Sunucu bağlantısı doğrulanamadı.' } }
    }
    startDate ??= new Date(Date.now() - 48 * 60 * 60 * 1000)

    const beforeIds = new Set(this.leads.map((l) => l.id))
    const beforeSnapshot = new Map(this.leads.map((l) => [l.id, l.updatedAt]))

    try {
      const winAny = typeof window !== 'undefined' ? (window as any) : null
      if (!userStore.centralAuthEnabled && winAny && typeof winAny.__demirturkPullCloudDb === 'function') {
        await winAny.__demirturkPullCloudDb()
        this.reloadFromCloudMirror()
        this.notify()
      }
    } catch {}

    // Read the requested history window, or continue from the latest central Meta record.
    let metaResult: { newCount: number; mergedCount: number; needsPageToken?: boolean; error?: string } = {
      newCount: 0,
      mergedCount: 0,
    }
    try {
      metaResult = await metaStore.fetchLeadsFromMeta(startDate, endDate, options?.onProgress)
    } catch (error) { metaResult.error = error instanceof Error ? error.message : 'Meta verileri alınamadı.' }

    if (userStore.centralAuthEnabled) {
      if (!pullingAccount || pullingAccount !== userStore.getCurrentUser()?.id) return { newCount: 0, updatedCount: 0, error: 'Veri alımı sırasında oturum değişti. Yeniden deneyin.' }
      if (!this.centralRefresh) return { newCount: metaResult.newCount, updatedCount: metaResult.mergedCount, error: metaResult.error || 'Müşteri listesi bağlantısı hazır değil. Yeniden deneyin.' }
      await this.centralRefresh()
      if (pullingAccount !== userStore.getCurrentUser()?.id) return { newCount: 0, updatedCount: 0, error: 'Veri alımı sırasında oturum değişti. Yeniden deneyin.' }
      const newCount = this.leads.filter(lead => !beforeIds.has(lead.id)).length
      const updatedCount = this.leads.filter(lead => beforeSnapshot.has(lead.id) && beforeSnapshot.get(lead.id) !== lead.updatedAt).length
      return { newCount: Math.max(newCount, metaResult.newCount), updatedCount: Math.max(updatedCount, metaResult.mergedCount), latestTime: new Date().toISOString(), error: metaResult.error || this.centralReadError || undefined }
    }

    if (!isSupabaseConfigured()) {
      let newCount = 0
      let updatedCount = 0
      for (const l of this.leads) {
        if (!beforeIds.has(l.id)) {
          newCount++
        } else if (beforeSnapshot.get(l.id) !== l.updatedAt) {
          updatedCount++
        }
      }
      return {
        newCount: Math.max(newCount, metaResult.newCount),
        updatedCount: Math.max(updatedCount, metaResult.mergedCount),
        latestTime: new Date().toISOString(),
        needsPageToken: metaResult.needsPageToken,
        error: metaResult.error,
      }
    }

    try {
      // 1. Mevcut yerel kayıtlardan en yeni oluşturulma zamanını (createdAt) bul
      let latestTimestamp = 0
      let latestIsoString: string | null = null

      for (const lead of this.leads) {
        if (lead.createdAt) {
          const t = new Date(lead.createdAt).getTime()
          if (!isNaN(t) && t > latestTimestamp) {
            latestTimestamp = t
            latestIsoString = lead.createdAt
          }
        }
      }

      // Ayrıca localStorage'daki son manuel çekim zamanını kontrol et
      const lastPullSaved = localStorage.getItem('demirturk_last_lead_manual_pull')
      if (lastPullSaved) {
        const pullT = new Date(lastPullSaved).getTime()
        if (!isNaN(pullT) && pullT > latestTimestamp) {
          latestTimestamp = pullT
          latestIsoString = lastPullSaved
        }
      }

      let newCount = 0
      let updatedCount = 0

      // 2. En son çekilen kayıttan sonrasını getir
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (latestTimestamp > 0 && latestIsoString) {
        query = query.gt('created_at', new Date(latestTimestamp).toISOString())
      }

      const { data: newDbRows, error } = await query

      if (error) {
        console.error('[LeadStore] pullLatestLeads query error:', error)
      } else if (newDbRows && newDbRows.length > 0) {
        const deletedIds = this.getDeletedIdsSet()
        const mapped = newDbRows.map(rowToLead)
        for (const incoming of mapped) {
          if (deletedIds.has(incoming.id)) continue
          incoming.leadNumber = this.allocateLeadNumber(incoming.companyName, incoming.id)
          const existingIdx = this.leads.findIndex((l) => l.id === incoming.id)
          if (existingIdx === -1) {
            this.leads.unshift(incoming)
            newCount++
            this.triggerNewLeadAlert(incoming)
          } else {
            this.leads[existingIdx] = incoming
            updatedCount++
          }
        }
      }

      // 3. Güvenlik Denetimi: Saat farkı veya uyku modundan dolayı kaçan olmaması için en son 50 kaydı tara
      const { data: recentRows } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (recentRows && recentRows.length > 0) {
        const deletedIds = this.getDeletedIdsSet()
        const mappedRecent = recentRows.map(rowToLead)
        for (const inc of mappedRecent) {
          if (deletedIds.has(inc.id)) continue
          const existingIdx = this.leads.findIndex((l) => l.id === inc.id)
          if (existingIdx === -1) {
            inc.leadNumber = this.allocateLeadNumber(inc.companyName, inc.id)
            this.leads.unshift(inc)
            newCount++
            this.triggerNewLeadAlert(inc)
          }
        }
      }

      const nowIso = new Date().toISOString()
      try {
        localStorage.setItem('demirturk_last_lead_manual_pull', nowIso)
      } catch {}

      if (newCount > 0 || updatedCount > 0) {
        this.saveToStorage(false)
        this.notify()
      }

      return {
        newCount,
        updatedCount,
        latestTime: nowIso,
        error: metaResult.error,
      }
    } catch (err: any) {
      console.error('[LeadStore] pullLatestLeads exception:', err)
      return {
        newCount: 0,
        updatedCount: 0,
        error: err?.message || 'Sunucu ile iletişim kurulamadı.',
      }
    }
  }

  private sortNewestFirst(list: Lead[]): Lead[] {
    return [...list].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime()
      const tB = new Date(b.createdAt || 0).getTime()
      if (!isNaN(tA) && !isNaN(tB) && tB !== tA) {
        return tB - tA
      }
      return (b.leadNumber || 0) - (a.leadNumber || 0)
    })
  }

  /**
   * Return all leads without security filter (internal use), sorted newest to oldest by default
   */
  public getAllRaw(): Lead[] {
    return this.sortNewestFirst(this.leads)
  }

  /**
   * Return leads filtered by current user's role and scope, sorted newest to oldest by default
   */
  public getAll(user?: AppUser | null): Lead[] {
    const sorted = this.sortNewestFirst(this.leads)
    if (!user) return sorted
    return permissionService.filterLeads(user, sorted)
  }

  public getById(id: string, user?: AppUser | null): Lead | undefined {
    const lead = this.leads.find((l) => l.id === id)
    if (!lead) return undefined
    if (user && !permissionService.canAccessLead(user, lead)) {
      return undefined
    }
    return lead
  }

  /**
   * UNIFIED CUSTOMER INTAKE (Meta & Manual):
   * Prevents duplicate customer records when multiple inquiries are submitted.
   * Preserves previous campaign and inquiry history.
   */
  public addOrMergeInquiry(
    data: {
      fullName: string
      phone: string
      secondaryPhone?: string
      whatsappPhone?: string
      email?: string
      source?: Lead['source']
      formName: string
      campaignName?: string
      channel?: string
      metaLeadgenId?: string
      budget?: number
      preferredHousingType?: string
      notes?: string
      owner?: string
      aiSuggestion?: string
      metaAnswers?: { question: string; answer: string }[]
      createdAt?: string
    },
    options?: { skipSave?: boolean }
  ): { lead: Lead; isNewCustomer: boolean } {
    const duplicate = data.metaLeadgenId ? this.leads.find(l => l.metaLeadId === data.metaLeadgenId || l.inquiries?.some(i => i.metaLeadgenId === data.metaLeadgenId)) : undefined
    if (duplicate) return { lead: duplicate, isNewCustomer: false }
    const cleanPhone = normalizePhone(data.phone)
    const matches = cleanPhone ? this.leads.filter(l => normalizePhone(l.phone) === cleanPhone) : []
    const existingIndex = matches.length === 1 ? this.leads.findIndex(l => l.id === matches[0].id) : -1

    const inquiry: CustomerInquiry = {
      id: 'inq-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      formName: data.formName,
      campaignName: data.campaignName,
      source: data.source || 'META_ADS',
      channel: data.channel || 'Meta Ads',
      metaLeadgenId: data.metaLeadgenId,
      budget: data.budget,
      preferredHousingType: data.preferredHousingType,
      notes: data.notes,
      metaAnswers: data.metaAnswers,
      createdAt: data.createdAt || new Date().toISOString(),
    }

    if (existingIndex !== -1) {
      // Customer already exists! MERGE inquiry without overwriting original contact or losing old campaigns
      const existing = this.leads[existingIndex]
      const currentInquiries = existing.inquiries || []

      // Prevent duplicate leadgen_id processing
      if (data.metaLeadgenId && currentInquiries.some((i) => i.metaLeadgenId === data.metaLeadgenId)) {
        return { lead: existing, isNewCustomer: false }
      }

      const updatedLead: Lead = {
        ...existing,
        inquiries: [inquiry, ...currentInquiries],
        budget: data.budget || existing.budget,
        preferredHousingType: data.preferredHousingType || existing.preferredHousingType,
        metaAnswers: data.metaAnswers || existing.metaAnswers,
        metaLeadId: data.metaLeadgenId || existing.metaLeadId,
        updatedAt: new Date().toISOString(),
      }

      this.leads[existingIndex] = updatedLead
      this.addActivity(
        existing.id,
        'NOTE',
        `Müşteriden yeni başvuru alındı. Kampanya/Form: ${data.formName}`,
        'Sistem'
      )
      if (!options?.skipSave) {
        this.saveToStorage()
      }
      syncService.saveLead(updatedLead)
      return { lead: updatedLead, isNewCustomer: false }
    }

    // New customer
    const initialAi: AiEvaluation | undefined = data.aiSuggestion
      ? {
          suggestion: data.aiSuggestion,
          confidence: 82,
          rationale: `Formdaki konut tipi (${data.preferredHousingType || 'Standart'}) ve bütçe verisi baz alınarak önerilmiştir.`,
          humanVerified: false,
        }
      : undefined

    // Otomatik Eşit Danışman Ataması: YALNIZCA Meta'dan çekilen datalarda yapılır
    let assignedUserId: string | undefined = undefined
    let assignedUserName: string | undefined = undefined
    const isMetaLead =
      !data.source ||
      data.source === 'META_ADS' ||
      data.source === 'GOOGLE_ADS' ||
      data.source === 'INSTAGRAM' ||
      data.source === 'FACEBOOK' ||
      Boolean(data.metaLeadgenId)
    if (isMetaLead) {
      const nextMT = this.getNextRoundRobinMT()
      if (nextMT) {
        assignedUserId = nextMT.id
        assignedUserName = nextMT.fullName
      }
    }

    const activeCompany = userStore.getCurrentUser()?.companyName || 'Demirtürk İnşaat'
    const seqNumber = this.allocateLeadNumber(activeCompany)
    const newId = `lead-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
    this.registerKnownLeadNumber(activeCompany, newId, seqNumber)

    const newLead: Lead = {
      id: newId,
      leadNumber: seqNumber,
      companyName: activeCompany,
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      secondaryPhone: data.secondaryPhone?.trim(),
      whatsappPhone: data.whatsappPhone?.trim() || data.phone.trim(),
      email: data.email?.trim(),
      source: data.source || 'META_ADS',
      formName: data.formName,
      channel: data.channel || 'Meta Ads',
      stage: 'NEW',
      owner: assignedUserName || data.owner || 'Atanmamış',
      tags: ['Yeni Giriş', data.preferredHousingType || 'Konut'],
      budget: data.budget,
      preferredHousingType: data.preferredHousingType,
      notes: data.notes,
      metaAnswers: data.metaAnswers,
      metaLeadId: data.metaLeadgenId,
      inquiries: [inquiry],
      assignedToUserId: assignedUserId,
      assignedToUserName: assignedUserName,
      assignmentHistory: assignedUserId && assignedUserName ? [
        {
          id: 'ah-init-' + Date.now(),
          assignedToUserId: assignedUserId,
          assignedToUserName: assignedUserName,
          assignedByUserId: 'system',
          assignedByUserName: 'Otomatik Eşit Dağıtım',
          assignedAt: new Date().toISOString(),
          note: 'Müşteri İlişkileri ekibi arasında sırayla otomatik atandı.',
        }
      ] : [],
      stageHistory: [
        {
          id: 'sh-1',
          toStage: 'NEW',
          changedByUserId: 'system',
          changedByUserName: 'Sistem',
          changedAt: new Date().toISOString(),
          note: 'Müşteri adayı sisteme kaydedildi.',
        },
      ],
      aiEvaluation: initialAi,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.leads = [newLead, ...this.leads]
    this.addActivity(
      newLead.id,
      'STAGE_CHANGE',
      `Yeni müşteri adayı oluşturuldu (Form: ${data.formName})`,
      'Sistem'
    )
    if (assignedUserName) {
      this.addActivity(
        newLead.id,
        'ASSIGNMENT',
        `Müşteri otomatik olarak ${assignedUserName} adlı müşteri temsilcisine atandı.`,
        'Sistem'
      )
    }
    if (!options?.skipSave) {
      this.saveToStorage()
    }
    syncService.saveLead(newLead)

    return { lead: newLead, isNewCustomer: true }
  }

  /**
   * Add a new lead (manual entry) with full property support and instant storage update
   */
  public async addManual(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>, requestId: string): Promise<Lead> {
    if (!userStore.centralAuthEnabled) return this.add(leadData)
    const account = userStore.getCurrentUser()?.id
    const client = userStore.getServerClient()
    if (!account || !client) throw Error('Müşteri kaydı için sunucu oturumu gerekli.')
    const saved = await createManualLead(client, requestId, leadData)
    if (userStore.getCurrentUser()?.id !== account) throw Error('Kayıt sırasında oturum değişti.')
    // Discard any read started before this confirmed write.
    this.centralManualWriteVersion++
    this.leads = [saved, ...this.leads.filter(lead => lead.id !== saved.id)]
    this.notify()
    return saved
  }

  public add(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    if (userStore.centralAuthEnabled) throw Error('Müşteriyi sunucu onaylı kayıt işlemiyle ekleyin.')
    const activeCompany = leadData.companyName || userStore.getCurrentUser()?.companyName || 'Demirtürk İnşaat'
    const seqNumber = this.allocateLeadNumber(activeCompany)
    const newId = `lead-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
    this.registerKnownLeadNumber(activeCompany, newId, seqNumber)
    
    // Manuel giriş olan datalarda otomatik atama yapılmaz; yalnızca açıkça seçildiyse atanır
    const assignedUserId = leadData.assignedToUserId || undefined
    const assignedUserName =
      leadData.assignedToUserName ||
      (leadData.owner &&
      leadData.owner !== 'Atanmamış' &&
      leadData.owner !== 'Demir Danışmanlık'
        ? leadData.owner
        : undefined)

    const isQualified = Boolean(leadData.isQualified || leadData.stage === 'QUALIFIED')

    const initialInquiry: CustomerInquiry = {
      id: 'inq-' + Date.now(),
      formName: leadData.formName || 'Manuel Kayıt',
      campaignName: 'Manuel Müşteri Girişi',
      source: leadData.source || 'DIRECT',
      channel: leadData.channel || 'Doğrudan / Ofis',
      budget: leadData.budget,
      preferredHousingType: leadData.preferredHousingType,
      notes: leadData.notes,
      createdAt: new Date().toISOString(),
    }

    const newLead: Lead = {
      id: newId,
      leadNumber: seqNumber,
      companyName: activeCompany,
      fullName: leadData.fullName.trim(),
      phone: leadData.phone.trim(),
      secondaryPhone: leadData.secondaryPhone?.trim(),
      whatsappPhone: leadData.whatsappPhone?.trim() || leadData.phone.trim(),
      email: leadData.email?.trim(),
      source: leadData.source || 'DIRECT',
      formName: leadData.formName || 'Manuel Kayıt',
      channel: leadData.channel || 'Doğrudan / Ofis',
      stage: leadData.stage || 'NEW',
      isQualified,
      owner: assignedUserName || 'Atanmamış',
      tags: leadData.tags && leadData.tags.length > 0 ? leadData.tags : ['Manuel Kayıt', leadData.preferredHousingType || 'Konut'],
      budget: leadData.budget,
      preferredHousingType: leadData.preferredHousingType,
      notes: leadData.notes,
      metaAnswers: leadData.metaAnswers,
      inquiries: [initialInquiry],
      assignedToUserId: assignedUserId,
      assignedToUserName: assignedUserName,
      assignmentHistory: assignedUserId && assignedUserName ? [
        {
          id: 'ah-' + Date.now(),
          assignedToUserId: assignedUserId,
          assignedToUserName: assignedUserName,
          assignedByUserId: 'system',
          assignedByUserName: 'Sistem',
          assignedAt: new Date().toISOString(),
          note: 'Müşteri kaydı oluşturulduğunda danışmana atandı.',
        }
      ] : [],
      stageHistory: [
        {
          id: 'sh-1',
          toStage: leadData.stage || 'NEW',
          changedByUserId: 'system',
          changedByUserName: 'Sistem',
          changedAt: new Date().toISOString(),
          note: 'Müşteri kaydı oluşturuldu.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.leads = [newLead, ...this.leads]
    this.addActivity(
      newLead.id,
      'STAGE_CHANGE',
      `Yeni müşteri kaydı oluşturuldu: ${newLead.fullName}`,
      'Sistem'
    )
    if (assignedUserName) {
      this.addActivity(
        newLead.id,
        'ASSIGNMENT',
        `Müşteri ${assignedUserName} adlı danışmana atandı.`,
        'Sistem'
      )
    }

    this.saveToStorage()
    syncService.saveLead(newLead)

    return newLead
  }

  public update(id: string, updates: Partial<Lead>, changedByUser?: AppUser | null): Lead | undefined {
    const index = this.leads.findIndex((l) => l.id === id)
    if (index === -1) return undefined

    const oldLead = this.leads[index]
    if (userStore.centralAuthEnabled && typeof updates.fullName === 'string' && typeof updates.phone === 'string') {
      const change: LeadWorkChange = {
        fullName: updates.fullName, phone: updates.phone, whatsappPhone: updates.whatsappPhone ?? null,
        secondaryPhone: updates.secondaryPhone ?? null, email: updates.email ?? null, budget: updates.budget ?? null,
        preferredHousingType: updates.preferredHousingType ?? null,
      }
      if ('assignedToUserId' in updates && updates.assignedToUserId !== oldLead.assignedToUserId) {
        change.assignedToUserId = updates.assignedToUserId ?? null
      }
      void this.saveCentralLeadWork(id, change)
      return oldLead
    }
    const updatedLead: Lead = {
      ...oldLead,
      ...updates,
      ...(updates.stage === 'QUALIFIED' ? { isQualified: true } : updates.stage && ['LOST','NO_INTENT'].includes(updates.stage) ? { isQualified: false } : {}),
      updatedAt: new Date().toISOString(),
    }

    const stageChanged = Boolean(updates.stage && updates.stage !== oldLead.stage)
    const qualifiedChanged = Boolean(
      updates.isQualified !== undefined && updates.isQualified !== oldLead.isQualified
    )

    if (stageChanged && updates.stage) {
      const stageEntry: StageHistoryEntry = {
        id: 'sh-' + Date.now(),
        fromStage: oldLead.stage,
        toStage: updates.stage,
        changedByUserId: changedByUser?.id || 'system',
        changedByUserName: changedByUser?.fullName || 'Danışman',
        changedAt: new Date().toISOString(),
        note: updates.notes,
      }
      updatedLead.stageHistory = [stageEntry, ...(oldLead.stageHistory || [])]
      this.addActivity(
        id,
        'STAGE_CHANGE',
        `Aşama güncellendi: ${oldLead.stage} ➔ ${updates.stage}`,
        changedByUser?.fullName || 'Danışman'
      )
    }

    this.leads[index] = updatedLead
    this.saveToStorage()
    syncService.saveLead(updatedLead)

    if (stageChanged || qualifiedChanged) metaStore.persistStageChange(updatedLead)



    return updatedLead
  }

  /**
   * Update only the lead's Meta CAPI status without re-triggering stage sync
   */
  public updateMetaCapiStatus(leadId: string, status: LeadMetaCapiStatus): void {
    const index = this.leads.findIndex((l) => l.id === leadId)
    if (index === -1) return
    const updatedLead: Lead = {
      ...this.leads[index],
      metaCapiStatus: status,
    }
    this.leads[index] = updatedLead
    this.saveToStorage()
  }

  /**
   * Manually trigger a Meta CAPI signal from Lead Detail Modal or CRM table
   */
  public async sendLeadSignalToMeta(
    leadId: string,
    signal: MetaCapiEventName,
    changedByUser?: AppUser | null,
    metaLeadgenId?: string
  ) {
    const lead = this.getById(leadId)
    if (!lead) return null

    const actor = changedByUser || userStore.getCurrentUser()
    if (!permissionService.canChangeStage(actor)) throw new Error('Aşama değiştirme yetkisi gerekli.')
    if (signal === 'QualifiedLead') this.update(leadId, { isQualified: true, stage: 'QUALIFIED', qualifiedByUserName: actor?.fullName, qualifiedAt: new Date().toISOString() }, actor)
    if (signal === 'DisqualifiedLead') this.update(leadId, { isQualified: false, stage: 'LOST' }, actor)

    const freshLead = this.getById(leadId) || lead
    const log = await metaStore.sendCapiLeadEvent(freshLead, signal, { metaLeadgenId })

    const statusBadge =
      log.status === 'SENT'
        ? 'Meta CAPI ile iletildi'
        : log.status === 'QUEUED'
        ? 'Meta CAPI kuyruğuna alındı'
        : 'Meta CAPI gönderim hatası'

    this.addActivity(
      leadId,
      'META_CAPI',
      `Meta sinyal sonucu: ${log.signalLabel} (${log.eventName}) • ${statusBadge}`,
      changedByUser?.fullName || 'Danışman'
    )

    return log
  }

  public async updateStage(id: string, newStage: LeadStage, changedByUser?: AppUser | null): Promise<boolean> {
    const isQual =
      newStage === 'QUALIFIED'
        ? true
        : newStage === 'LOST' || newStage === 'NO_INTENT' || newStage === 'NEW' || newStage === 'CONTACTED'
        ? false
        : undefined
    const change = { stage: newStage, ...(isQual !== undefined ? { isQualified: isQual } : {}) }
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, change)
    return Boolean(this.update(
      id,
      change,
      changedByUser
    ))
  }

  public async updateCallStatus(id: string, callStatus: CallCenterStatus | string, changedByUser?: AppUser | null): Promise<boolean> {
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, { callStatus })
    const lead = this.getById(id)
    if (!lead) return false
    const label = CALL_STATUS_OPTIONS.find((o) => o.id === callStatus)?.label || String(callStatus)
    this.update(id, { callStatus }, changedByUser)
    this.addActivity(
      id,
      'CALL',
      `Çağrı / Bilgi durumu güncellendi: ${label}`,
      changedByUser?.fullName || 'Danışman'
    )
    return true
  }

  /**
   * Customer Relations qualification step
   */
  public qualifyLead(
    id: string,
    user: AppUser,
    isQualified: boolean,
    qualificationNote?: string
  ): Lead | undefined {
    const lead = this.getById(id)
    if (!lead) return undefined

    const targetStage: LeadStage = isQualified ? 'QUALIFIED' : 'LOST'
    const updated = this.update(
      id,
      {
        stage: targetStage,
        isQualified,
        qualifiedByUserName: user.fullName,
        qualifiedAt: new Date().toISOString(),
        notes: qualificationNote ? `${lead.notes || ''}\n[Nitelik]: ${qualificationNote}` : lead.notes,
      },
      user
    )

    this.addActivity(
      id,
      'QUALIFICATION',
      isQualified
        ? `Müşteri İlişkileri tarafından 'Nitelikli' olarak doğrulandı.`
        : `Müşteri İlişkileri tarafından olumsuz olarak işaretlendi.`,
      user.fullName
    )
    return updated
  }

  /**
   * Müşteri İlişkileri, Pazarlama veya Yönetim tarafından kaydın manuel olarak Satışa iletilmesi ("Satışa Devret").
   * Bu işlem yapılmadan hiçbir veri (Potansiyel müşteri, Web sitesi, Google, Meta vb.) Satışa devredilmez.
   */
  public async assignToSales(
    id: string,
    salesUser: AppUser | null | undefined,
    assignedByUser: AppUser,
    note?: string
  ): Promise<boolean> {
    if (!permissionService.canHandOverToSales(assignedByUser)) {
      return false
    }
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, { salesTarget: salesUser?.id ?? 'ALL_SALES', salesNote: note })
    const lead = this.getById(id)
    if (!lead) return false

    const nowIso = new Date().toISOString()
    const targetId = salesUser ? salesUser.id : 'ALL_SALES'
    const targetName = salesUser ? salesUser.fullName : 'Satış Ekibi (Genel Havuz)'

    const assignmentEntry: AssignmentHistoryEntry = {
      id: 'ah-' + Date.now(),
      assignedToUserId: targetId,
      assignedToUserName: targetName,
      assignedByUserId: assignedByUser.id,
      assignedByUserName: assignedByUser.fullName,
      assignedByDepartment: assignedByUser.department,
      assignedAt: nowIso,
      note,
      isSalesHandover: true,
    }

    const updated = this.update(
      id,
      {
        handedOverToSales: true,
        handedOverToSalesAt: nowIso,
        handedOverToSalesByUserId: assignedByUser.id,
        handedOverToSalesByUserName: assignedByUser.fullName,
        handedOverToSalesByDepartment: assignedByUser.department,
        salesRepUserId: salesUser ? salesUser.id : undefined,
        salesRepUserName: salesUser ? salesUser.fullName : undefined,
        assignmentHistory: [assignmentEntry, ...(lead.assignmentHistory || [])],
        ...(note
          ? {
              notes: lead.notes ? `${lead.notes}\n[Satış Devir Notu]: ${note}` : `[Satış Devir Notu]: ${note}`,
            }
          : {}),
      },
      assignedByUser
    )

    this.addActivity(
      id,
      'ASSIGNMENT',
      salesUser
        ? `Müşteri ${assignedByUser.department} (${assignedByUser.fullName}) tarafından manuel olarak Satışa devredildi (Danışman: ${salesUser.fullName}).`
        : `Müşteri ${assignedByUser.department} (${assignedByUser.fullName}) tarafından manuel olarak Satış departmanına devredildi.`,
      assignedByUser.fullName
    )
    return Boolean(updated)
  }

  /**
   * Satışa iletilmiş bir kaydın satış devrini geri çeker (Müşteri İlişkileri, Pazarlama veya Yönetim).
   */
  public async revokeSalesHandover(id: string, revokedByUser: AppUser): Promise<boolean> {
    if (!permissionService.canHandOverToSales(revokedByUser)) {
      return false
    }
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, { salesTarget: null })
    const lead = this.getById(id)
    if (!lead) return false

    const nowIso = new Date().toISOString()
    const revokeEntry: AssignmentHistoryEntry = {
      id: 'ah-rev-' + Date.now(),
      assignedToUserId: '',
      assignedToUserName: 'Satış Devri Geri Çekildi',
      assignedByUserId: revokedByUser.id,
      assignedByUserName: revokedByUser.fullName,
      assignedByDepartment: revokedByUser.department,
      assignedAt: nowIso,
      isSalesHandover: false,
    }

    const updated = this.update(
      id,
      {
        handedOverToSales: false,
        handedOverToSalesAt: undefined,
        handedOverToSalesByUserId: undefined,
        handedOverToSalesByUserName: undefined,
        handedOverToSalesByDepartment: undefined,
        salesRepUserId: undefined,
        salesRepUserName: undefined,
        assignmentHistory: [revokeEntry, ...(lead.assignmentHistory || [])],
      },
      revokedByUser
    )

    this.addActivity(
      id,
      'ASSIGNMENT',
      `Satış devri ${revokedByUser.department} (${revokedByUser.fullName}) tarafından manuel olarak geri çekildi.`,
      revokedByUser.fullName
    )
    return Boolean(updated)
  }

  /**
   * Quick toggle qualified status directly from table toggle button
   */
  public async toggleLeadQualified(
    id: string,
    isQualified: boolean,
    changedByUser?: AppUser | null
  ): Promise<boolean> {
    const lead = this.getById(id)
    if (!lead) return false

    const updates: Partial<Lead> = {
      isQualified,
      qualifiedByUserName: isQualified ? (changedByUser?.fullName || 'Danışman') : undefined,
      qualifiedAt: isQualified ? new Date().toISOString() : undefined,
    }

    if (isQualified && lead.stage === 'NEW') {
      updates.stage = 'QUALIFIED'
    } else if (!isQualified && lead.stage === 'QUALIFIED') {
      updates.stage = 'CONTACTED'
    }

    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, { isQualified, stage: updates.stage })
    const updated = this.update(id, updates, changedByUser)

    // Not: Nitelikli durumunda Meta'ya otomatik veri gönderilmez; Pazarlama > Kampanyalar > "Veriyi Gönder" ile manuel gönderilir.

    this.addActivity(
      id,
      'QUALIFICATION',
      isQualified
        ? `Müşteri 'Nitelikli' olarak işaretlendi.`
        : `Müşteri 'Nitelikli' durumu kaldırıldı.`,
      changedByUser?.fullName || 'Danışman'
    )
    return Boolean(updated)
  }

  /**
   * Update lead notes / explanation from table or modal
   */
  public async updateNotes(
    id: string,
    notes: string,
    changedByUser?: AppUser | null
  ): Promise<boolean> {
    const cleanNotes = formatSentenceNote(notes)
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(id, { notes: cleanNotes })
    const updated = this.update(id, { notes: cleanNotes }, changedByUser)
    if (updated) {
      this.addActivity(
        id,
        'NOTE',
        `Açıklama güncellendi: ${cleanNotes ? (cleanNotes.length > 50 ? cleanNotes.substring(0, 50) + '...' : cleanNotes) : '(Temizlendi)'}`,
        changedByUser?.fullName || 'Danışman'
      )
    }
    return Boolean(updated)
  }

  /**
   * Müşteri İlişkileri temsilcileri arasında sırayla (Round-Robin) bir sonraki danışmanı seçer
   */
  public getNextRoundRobinMT(): AppUser | null {
    try {
      const allUsers = userStore.getAllUsers()
      const eligibleStaff = allUsers.filter(
        (u) =>
          (u.department === 'Müşteri İlişkileri' || u.departments?.includes('Müşteri İlişkileri')) &&
          u.role !== 'ADMIN'
      )
      if (eligibleStaff.length === 0) return null

      let lastIdx = -1
      const stored = localStorage.getItem(STORAGE_KEY_LAST_ASSIGNED_MT)
      if (stored !== null) {
        lastIdx = parseInt(stored, 10)
        if (isNaN(lastIdx)) lastIdx = -1
      }

      const nextIdx = (lastIdx + 1) % eligibleStaff.length
      localStorage.setItem(STORAGE_KEY_LAST_ASSIGNED_MT, nextIdx.toString())
      return eligibleStaff[nextIdx]
    } catch {
      return null
    }
  }

  /**
   * Distribute leads equally across Call Center agents (Round-Robin)
   * Only real non-admin staff in Müşteri İlişkileri can be assigned. If empty, does nothing.
   */
  public async autoAssignCallCenterLeads(callCenterUsers: AppUser[]): Promise<void> {
    if (userStore.centralAuthEnabled) {
      const client = userStore.getServerClient()
      if (!client) throw Error('Sunucu oturumu gerekli.')
      const { error } = await client.rpc('crm_assign_pending_meta_leads').abortSignal(AbortSignal.timeout(15000))
      if (error) throw Error('Dağıtım sunucuda tamamlanamadı. Sunucu kurulumunu ve yetkinizi kontrol edin.')
      await this.centralRefresh?.()
      return
    }
    const eligibleStaff = (callCenterUsers || []).filter(
      (u) =>
        (u.department === 'Müşteri İlişkileri' || u.departments?.includes('Müşteri İlişkileri')) &&
        u.role !== 'ADMIN'
    )
    if (eligibleStaff.length === 0) return

    let lastIdx = -1
    const stored = localStorage.getItem(STORAGE_KEY_LAST_ASSIGNED_MT)
    if (stored !== null) {
      lastIdx = parseInt(stored, 10)
      if (isNaN(lastIdx)) lastIdx = -1
    }

    let changed = false
    this.leads = this.leads.map((lead) => {
      // Yalnızca Meta'dan çekilen ve henüz atanmamış datalarda otomatik atama yapılır
      const isMetaLead =
        lead.source === 'META_ADS' ||
        lead.source === 'INSTAGRAM' ||
        lead.source === 'FACEBOOK' ||
        Boolean(lead.metaLeadId)
      if (!lead.assignedToUserId && isMetaLead) {
        lastIdx = (lastIdx + 1) % eligibleStaff.length
        const assignedUser = eligibleStaff[lastIdx]
        changed = true
        return {
          ...lead,
          assignedToUserId: assignedUser.id,
          assignedToUserName: assignedUser.fullName,
          owner: assignedUser.fullName,
          updatedAt: new Date().toISOString(),
        }
      }
      return lead
    })

    if (changed) {
      localStorage.setItem(STORAGE_KEY_LAST_ASSIGNED_MT, lastIdx.toString())
      this.saveToStorage()
    }
  }

  /**
   * Directly assign or re-assign lead to any user
   */
  public async assignLeadToUser(
    leadId: string,
    targetUser: AppUser,
    assignedByUser?: AppUser | null
  ): Promise<boolean> {
    if (assignedByUser?.role !== 'ADMIN' && assignedByUser?.department === 'Müşteri İlişkileri') return false
    if (userStore.centralAuthEnabled) return this.saveCentralLeadWork(leadId, { assignedToUserId: targetUser.id })
    return Boolean(this.update(
      leadId,
      {
        assignedToUserId: targetUser.id,
        assignedToUserName: targetUser.fullName,
        owner: targetUser.fullName,
      },
      assignedByUser
    ))
  }

  public async transferToRepresentative(leadId: string, targetId: string): Promise<boolean> {
    const actor = userStore.getCurrentUser()
    const client = userStore.getServerClient()
    const lead = this.getById(leadId)
    if (!actor || !client || !lead || lead.assignedToUserId !== actor.id || targetId === actor.id) return false
    if (this.centralWrites.has(leadId)) return false
    let pending = this.pendingTransfers.get(leadId)
    if (pending && pending.targetId !== targetId) {
      this.centralWriteError = 'Önceki devri aynı temsilciyle tekrar doğrulayın.'
      this.notify()
      return false
    }
    pending ??= { requestId: crypto.randomUUID(), targetId, expected: lead.updatedAt }
    this.pendingTransfers.set(leadId, pending)
    this.centralWrites.set(leadId, pending.requestId)
    try {
      const { data, error } = await client.rpc('crm_transfer_lead', {
        p_request: pending.requestId, p_id: leadId, p_expected: pending.expected, p_target: targetId,
      }).abortSignal(AbortSignal.timeout(15000))
      if (userStore.getCurrentUser()?.id !== actor.id) return false
      if (error) {
        if (error.code === '40001' || String(error.message).includes('crm_transfer_forbidden') || String(error.message).includes('crm_transfer_invalid')) {
          this.pendingTransfers.delete(leadId)
          void this.centralRefresh?.()
        }
        throw Error(error.code === '40001' ? 'Müşteri kaydı değişmiş. Listeyi yenileyip tekrar deneyin.' : 'Devir sunucuda doğrulanamadı. Aynı temsilciyle yeniden deneyin.')
      }
      if (data?.id !== leadId || data.transferred !== true) throw Error('Devir sonucu doğrulanamadı. Aynı temsilciyle yeniden deneyin.')
      this.centralManualWriteVersion++
      this.leads = this.leads.filter(item => item.id !== leadId)
      delete this.activities[leadId]
      this.pendingTransfers.delete(leadId)
      this.centralWriteError = ''
      void this.centralRefresh?.()
      return true
    } catch (error) {
      if (userStore.getCurrentUser()?.id === actor.id) this.centralWriteError = error instanceof Error ? error.message : 'Devir onayı alınamadı. Aynı işlemle yeniden deneyin.'
      return false
    } finally {
      if (userStore.getCurrentUser()?.id === actor.id) { this.centralWrites.delete(leadId); this.notify() }
    }
  }

  /**
   * Verify AI recommendation by a human agent
   */
  public verifyAiEvaluation(
    id: string,
    user: AppUser,
    isApproved: boolean,
    customNote?: string
  ): Lead | undefined {
    const lead = this.getById(id)
    if (!lead || !lead.aiEvaluation) return undefined

    const updatedAi: AiEvaluation = {
      ...lead.aiEvaluation,
      humanVerified: true,
      verifiedByUserId: user.id,
      verifiedByUserName: user.fullName,
      verifiedAt: new Date().toISOString(),
      rationale: customNote || lead.aiEvaluation.rationale,
    }

    const updated = this.update(id, { aiEvaluation: updatedAi }, user)
    this.addActivity(
      id,
      'NOTE',
      `Yapay Zekâ profil analizi ${user.fullName} tarafından onaylandı.`,
      user.fullName
    )
    return updated
  }

  public async archiveLeads(ids: string[]): Promise<boolean> {
    if (!userStore.centralAuthEnabled) return ids.every(id => this.deleteLegacy(id))
    const actor = userStore.getCurrentUser()
    const client = userStore.getServerClient()
    const unique = [...new Set(ids)].sort()
    if (!actor || !client || this.archiving || unique.length === 0 || unique.length > 100) return false
    if (!permissionService.canDeleteCustomer(actor)) return false
    if (unique.some(id => this.centralWrites.has(id))) return false
    if (this.pendingArchive && JSON.stringify(this.pendingArchive.ids) !== JSON.stringify(unique)) {
      this.centralWriteError = 'Önceki silme işlemini aynı müşterilerle yeniden doğrulayın.'
      this.notify()
      return false
    }
    if (!this.pendingArchive) {
      const records = unique.map(id => this.getById(id, actor))
      if (records.some(lead => !lead)) return false
      this.pendingArchive = { ids: unique, records: records.map(lead => ({ id: lead!.id, expected: lead!.updatedAt })), requestId: crypto.randomUUID() }
    }
    this.archiving = true
    try {
      await createLeadArchiveRepository(client).archive(this.pendingArchive.requestId, this.pendingArchive.records)
      if (userStore.getCurrentUser()?.id !== actor.id) return false
      this.centralManualWriteVersion++
      this.leads = this.leads.filter(lead => !unique.includes(lead.id))
      for (const id of unique) delete this.activities[id]
      this.pendingArchive = null
      this.centralWriteError = ''
      void this.centralRefresh?.()
      return true
    } catch (error) {
      if (userStore.getCurrentUser()?.id === actor.id) {
        if (error instanceof LeadArchiveError && error.definitive) { this.pendingArchive = null; void this.centralRefresh?.() }
        this.centralWriteError = error instanceof Error ? error.message : 'Silme sonucu alınamadı.'
      }
      return false
    } finally { this.archiving = false; this.notify() }
  }

  public async delete(id: string): Promise<boolean> {
    return this.archiveLeads([id])
  }

  private deleteLegacy(id: string): boolean {
    const target = this.leads.find((l) => l.id === id)
    allowManualWebsiteDelete(id)
    const idsToMarkDeleted = [id]
    if (target?.phone) {
      const cleanPhone = String(target.phone).replace(/\D/g, '').slice(-10)
      if (cleanPhone && cleanPhone.length >= 7) {
        const phoneKey = `phone:${cleanPhone}`
        idsToMarkDeleted.push(phoneKey)
        allowManualWebsiteDelete(phoneKey)
      }
    }
    if (target?.inquiries) {
      for (const inq of target.inquiries) {
        if (inq.id) {
          idsToMarkDeleted.push(inq.id)
          allowManualWebsiteDelete(inq.id)
        }
      }
    }
    if (target) {
      trashStore.addItemToTrash(STORAGE_KEY_LEADS, target)
    }
    this.addDeletedIds(idsToMarkDeleted)
    const beforeLen = this.leads.length
    this.leads = this.leads.filter((l) => l.id !== id)
    delete this.activities[id]
    // Not: Silinen kaydın numarası (seqStore) asla geri çekilmez; sıradaki yeni lead kaldığı sayıdan devam eder.
    this.saveToStorage()
    syncService.deleteLead(id)
    return this.leads.length < beforeLen
  }

  public getActivities(leadId: string): LeadActivity[] {
    return this.activities[leadId] || []
  }

  public getAllActivities(): Record<string, LeadActivity[]> {
    return { ...this.activities }
  }

  public addActivity(
    leadId: string,
    type: LeadActivity['type'],
    content: string,
    author = 'Danışman'
  ): void {
    if (userStore.centralAuthEnabled && type === 'NOTE') {
      void this.saveCentralLeadWork(leadId, { timelineNote: content })
      return
    }
    const act: LeadActivity = {
      id: 'act-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      leadId,
      type,
      content,
      author,
      createdAt: new Date().toISOString(),
    }
    const current = this.activities[leadId] || []
    this.activities[leadId] = [act, ...current]
    this.saveToStorage()
    syncService.saveActivity(act)
  }

  public resetToDefault(): void {
    // Web sitesinden gelen kayıtlar kodla/sıfırlamayla kesinlikle silinmez; diğerleri çöp kutusuna taşınır
    const nonWebLeads = this.leads.filter((l) => !isWebsiteRecord(l))
    for (const item of nonWebLeads) {
      trashStore.addItemToTrash(STORAGE_KEY_LEADS, item)
    }
    this.leads = this.leads.filter((l) => isWebsiteRecord(l))
    this.saveToStorage()
  }
}

export const leadStore = new LeadStore()

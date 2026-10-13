import {
  Lead,
  LeadActivity,
  LeadStage,
  CustomerInquiry,
  AssignmentHistoryEntry,
  StageHistoryEntry,
  AiEvaluation,
} from '@/types/lead'
import { AppUser, userStore } from './userStore'
import { permissionService } from './permissionService'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { syncService } from './syncService'
import { rowToLead, rowToActivity } from './dbMapper'

import { playNewLeadChime } from '@/utils/audioAlert'

const STORAGE_KEY_LEADS = 'demirturk_leads_v2'
const STORAGE_KEY_ACTIVITIES = 'demirturk_activities_v2'
const STORAGE_KEY_LAST_ASSIGNED_MT = 'demirturk_last_assigned_mt_idx'

type Listener = () => void

function cleanPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/[^\d+]/g, '').trim()
}

class LeadStore {
  private leads: Lead[] = []
  private activities: Record<string, LeadActivity[]> = {}
  private listeners: Set<Listener> = new Set()
  private realtimeChannel: any = null
  private pollInterval: any = null

  constructor() {
    this.loadFromStorage()
    this.initRealtime()
    this.initFastPolling()
  }

  public setLoadedLeads(leads: Lead[], activities: Record<string, LeadActivity[]>) {
    // Merge loaded leads while preserving any incoming leads from realtime
    const currentMap = new Map(this.leads.map((l) => [l.id, l]))
    const merged = [...(leads || [])]

    // Keep any leads that exist locally but were not in the snapshot
    for (const [id, lead] of currentMap) {
      if (!merged.some((m) => m.id === id)) {
        merged.unshift(lead)
      }
    }

    this.leads = merged
    this.activities = activities || {}
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(this.leads))
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(this.activities))
    } catch {}
    this.notify()
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
        for (const raw of latestLeads) {
          const mapped = rowToLead(raw)
          if (!this.leads.some((l) => l.id === mapped.id)) {
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

    // Purge any fake mock leads and any accidental admin/fake call center assignments
    const fakeLeadIds = new Set(['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5', 'lead-6', 'lead-7'])
    const fakeDanismanNames = new Set(['Selin Yılmaz', 'Can Özdemir', 'Mert Demir', 'Berkant Çalışkan'])

    const prevCount = this.leads.length
    this.leads = this.leads
      .filter((l) => !fakeLeadIds.has(l.id))
      .map((l) => {
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

    // Migrate any cached leads before Oct 3 from NEW to CONTACTED (moved from İletişim to Tümü)
    const oct3Cutoff = new Date('2026-10-02T21:00:00.000Z').getTime()
    this.leads = this.leads.map((l) => {
      if (l.stage === 'NEW' && new Date(l.createdAt).getTime() < oct3Cutoff) {
        return {
          ...l,
          stage: 'CONTACTED' as LeadStage,
        }
      }
      return l
    })

    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(this.leads))
    } catch {}
  }

  private saveToStorage(_syncCloud = true) {
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

  /**
   * Directly refresh all leads from Supabase cloud database
   */
  public async refreshFromSupabase(): Promise<number> {
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
  public async pullLatestLeads(): Promise<{
    newCount: number
    updatedCount: number
    latestTime?: string
    error?: string
  }> {
    if (!isSupabaseConfigured()) {
      return {
        newCount: 0,
        updatedCount: 0,
        error: 'Bulut veritabanı bağlantısı henüz yapılandırılmamış.',
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
        const mapped = newDbRows.map(rowToLead)
        for (const incoming of mapped) {
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
        const mappedRecent = recentRows.map(rowToLead)
        for (const inc of mappedRecent) {
          const existingIdx = this.leads.findIndex((l) => l.id === inc.id)
          if (existingIdx === -1) {
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

  /**
   * Return all leads without security filter (internal use)
   */
  public getAllRaw(): Lead[] {
    return [...this.leads]
  }

  /**
   * Return leads filtered by current user's role and scope
   */
  public getAll(user?: AppUser | null): Lead[] {
    if (!user) return [...this.leads]
    return permissionService.filterLeads(user, this.leads)
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
  public addOrMergeInquiry(data: {
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
  }): { lead: Lead; isNewCustomer: boolean } {
    const cleanPhone = cleanPhoneNumber(data.phone)
    const existingIndex = this.leads.findIndex(
      (l) => cleanPhoneNumber(l.phone) === cleanPhone || (cleanPhone.length > 7 && cleanPhoneNumber(l.phone).endsWith(cleanPhone.slice(-7)))
    )

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
      createdAt: new Date().toISOString(),
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
        updatedAt: new Date().toISOString(),
      }

      this.leads[existingIndex] = updatedLead
      this.addActivity(
        existing.id,
        'NOTE',
        `Müşteriden yeni başvuru alındı. Kampanya/Form: ${data.formName}`,
        'Sistem'
      )
      this.saveToStorage()
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

    // Otomatik Eşit Danışman Ataması (Müşteri İlişkileri temsilcileri arasında Round-Robin)
    let assignedUserId: string | undefined = undefined
    let assignedUserName: string | undefined = undefined
    const nextMT = this.getNextRoundRobinMT()
    if (nextMT) {
      assignedUserId = nextMT.id
      assignedUserName = nextMT.fullName
    }

    const newLead: Lead = {
      id: 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
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
      createdAt: new Date().toISOString(),
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
    this.saveToStorage()
    syncService.saveLead(newLead)
    return { lead: newLead, isNewCustomer: true }
  }

  /**
   * Add a new lead (manual entry) with full property support and instant storage update
   */
  public add(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    const newId = 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
    
    // Determine consultant assignment
    let assignedUserId = leadData.assignedToUserId
    let assignedUserName = leadData.assignedToUserName || (leadData.owner && leadData.owner !== 'Atanmamış' && leadData.owner !== 'Demir Danışmanlık' ? leadData.owner : undefined)

    if (!assignedUserId && !assignedUserName) {
      const nextMT = this.getNextRoundRobinMT()
      if (nextMT) {
        assignedUserId = nextMT.id
        assignedUserName = nextMT.fullName
      }
    }

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
    const updatedLead: Lead = {
      ...oldLead,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    if (updates.stage && updates.stage !== oldLead.stage) {
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
    return updatedLead
  }

  public updateStage(id: string, newStage: LeadStage, changedByUser?: AppUser | null): void {
    this.update(id, { stage: newStage }, changedByUser)
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
   * Assign lead to Sales Representative (keeps assignment history)
   */
  public assignToSales(
    id: string,
    salesUser: AppUser,
    assignedByUser: AppUser,
    note?: string
  ): Lead | undefined {
    const lead = this.getById(id)
    if (!lead) return undefined

    const assignmentEntry: AssignmentHistoryEntry = {
      id: 'ah-' + Date.now(),
      assignedToUserId: salesUser.id,
      assignedToUserName: salesUser.fullName,
      assignedByUserId: assignedByUser.id,
      assignedByUserName: assignedByUser.fullName,
      assignedAt: new Date().toISOString(),
      note,
    }

    const updated = this.update(
      id,
      {
        assignedToUserId: salesUser.id,
        assignedToUserName: salesUser.fullName,
        owner: salesUser.fullName,
        assignmentHistory: [assignmentEntry, ...(lead.assignmentHistory || [])],
        stage: lead.stage === 'NEW' ? 'CONTACTED' : lead.stage,
      },
      assignedByUser
    )

    this.addActivity(
      id,
      'ASSIGNMENT',
      `Müşteri Satış Danışmanı ${salesUser.fullName} adlı kullanıcıya atandı.`,
      assignedByUser.fullName
    )
    return updated
  }

  /**
   * Quick toggle qualified status directly from table toggle button
   */
  public toggleLeadQualified(
    id: string,
    isQualified: boolean,
    changedByUser?: AppUser | null
  ): Lead | undefined {
    const lead = this.getById(id)
    if (!lead) return undefined

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

    const updated = this.update(id, updates, changedByUser)

    this.addActivity(
      id,
      'QUALIFICATION',
      isQualified
        ? `Müşteri 'Nitelikli' olarak işaretlendi.`
        : `Müşteri 'Nitelikli' durumu kaldırıldı.`,
      changedByUser?.fullName || 'Danışman'
    )
    return updated
  }

  /**
   * Update lead notes / explanation from table or modal
   */
  public updateNotes(
    id: string,
    notes: string,
    changedByUser?: AppUser | null
  ): Lead | undefined {
    const cleanNotes = notes.trim()
    const updated = this.update(id, { notes: cleanNotes }, changedByUser)
    if (updated) {
      this.addActivity(
        id,
        'NOTE',
        `Açıklama güncellendi: ${cleanNotes ? (cleanNotes.length > 50 ? cleanNotes.substring(0, 50) + '...' : cleanNotes) : '(Temizlendi)'}`,
        changedByUser?.fullName || 'Danışman'
      )
    }
    return updated
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
  public autoAssignCallCenterLeads(callCenterUsers: AppUser[]): void {
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
      // If not yet assigned to an agent, assign to call center round-robin
      if (!lead.assignedToUserId) {
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
  public assignLeadToUser(
    leadId: string,
    targetUser: AppUser,
    assignedByUser?: AppUser | null
  ): Lead | undefined {
    return this.update(
      leadId,
      {
        assignedToUserId: targetUser.id,
        assignedToUserName: targetUser.fullName,
        owner: targetUser.fullName,
      },
      assignedByUser
    )
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

  public delete(id: string): boolean {
    const beforeLen = this.leads.length
    this.leads = this.leads.filter((l) => l.id !== id)
    delete this.activities[id]
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
    this.leads = []
    this.activities = {}
    this.saveToStorage()
  }
}

export const leadStore = new LeadStore()

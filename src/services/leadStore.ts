import {
  Lead,
  LeadActivity,
  LeadStage,
  CustomerInquiry,
  AssignmentHistoryEntry,
  StageHistoryEntry,
  AiEvaluation,
} from '@/types/lead'
import { AppUser } from './userStore'
import { permissionService } from './permissionService'

const STORAGE_KEY_LEADS = 'demirturk_leads_v2'
const STORAGE_KEY_ACTIVITIES = 'demirturk_activities_v2'

type Listener = () => void

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim()
}

class LeadStore {
  private leads: Lead[] = []
  private activities: Record<string, LeadActivity[]> = {}
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
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
  }

  private saveToStorage() {
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
      owner: data.owner || 'Atanmamış',
      tags: ['Yeni Giriş', data.preferredHousingType || 'Konut'],
      budget: data.budget,
      preferredHousingType: data.preferredHousingType,
      notes: data.notes,
      inquiries: [inquiry],
      assignmentHistory: [],
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
    this.saveToStorage()
    return { lead: newLead, isNewCustomer: true }
  }

  /**
   * Compatibility wrapper for existing add calls
   */
  public add(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    return this.addOrMergeInquiry({
      fullName: leadData.fullName,
      phone: leadData.phone,
      secondaryPhone: leadData.secondaryPhone,
      whatsappPhone: leadData.whatsappPhone,
      email: leadData.email,
      source: leadData.source,
      formName: leadData.formName,
      channel: leadData.channel,
      budget: leadData.budget,
      preferredHousingType: leadData.preferredHousingType,
      notes: leadData.notes,
      owner: leadData.owner,
    }).lead
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
    return this.leads.length < beforeLen
  }

  public getActivities(leadId: string): LeadActivity[] {
    return this.activities[leadId] || []
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
  }

  public resetToDefault(): void {
    this.leads = []
    this.activities = {}
    this.saveToStorage()
  }
}

export const leadStore = new LeadStore()

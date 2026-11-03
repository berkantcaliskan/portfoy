export type LeadStage =
  | 'NEW'             // Potansiyel Müşteri (Meta: Lead)
  | 'CONTACTED'       // İletişim (Meta: Contact)
  | 'UNDECIDED'       // Legacy: Kararsız
  | 'NO_INTENT'       // Legacy: Satın Alma Niyeti Yok
  | 'QUALIFIED'       // Nitelikli (Meta: QualifiedLead)
  | 'APPOINTMENT'     // Legacy: Randevu / Teklif (Meta: Schedule)
  | 'PRESENTATION'    // Legacy: Sunum
  | 'OFFER'           // Teklif (Meta: Schedule)
  | 'WON'             // Dönüşüm (Meta: Purchase)
  | 'LOST'            // Potansiyel Değil (Meta: DisqualifiedLead)

export type CallCenterStatus =
  | 'WAITING'         // Bekliyor
  | 'CALLED'          // Arandı
  | 'CALL_AGAIN'      // Tekrar Ara
  | 'UNREACHABLE'     // Ulaşılamadı
  | 'INFO_GIVEN'      // Bilgi Verildi
  | 'UNDECIDED'       // Kararsız
  | 'APPOINTMENT_SET' // Randevu Alındı
  | 'NO_INTENT'       // Satın Alma Niyeti Yok

export const CALL_STATUS_OPTIONS: { id: CallCenterStatus; label: string; dotColor: string }[] = [
  { id: 'WAITING', label: 'Bekliyor', dotColor: '#f59e0b' },
  { id: 'CALLED', label: 'Arandı', dotColor: '#38bdf8' },
  { id: 'CALL_AGAIN', label: 'Tekrar ara', dotColor: '#fb923c' },
  { id: 'UNREACHABLE', label: 'Ulaşılamadı', dotColor: '#94a3b8' },
  { id: 'INFO_GIVEN', label: 'Bilgi verildi', dotColor: '#2dd4bf' },
  { id: 'UNDECIDED', label: 'Kararsız', dotColor: '#fcd34d' },
  { id: 'APPOINTMENT_SET', label: 'Randevu alındı', dotColor: '#818cf8' },
  { id: 'NO_INTENT', label: 'Satın alma niyeti yok', dotColor: '#f43f5e' },
]

export interface StageConfig {
  id: LeadStage
  label: string
  color: string
  borderColor: string
  bgLight: string
  accentColor: string
}

export const STAGE_CONFIGS: Record<LeadStage, StageConfig> = {
  NEW: {
    id: 'NEW',
    label: 'Potansiyel müşteri',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgLight: 'bg-amber-500/10',
    accentColor: '#f59e0b',
  },
  CONTACTED: {
    id: 'CONTACTED',
    label: 'İletişim',
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgLight: 'bg-sky-500/10',
    accentColor: '#38bdf8',
  },
  UNDECIDED: {
    id: 'UNDECIDED',
    label: 'İletişim',
    color: 'text-amber-300',
    borderColor: 'border-amber-400/30',
    bgLight: 'bg-amber-400/10',
    accentColor: '#fcd34d',
  },
  NO_INTENT: {
    id: 'NO_INTENT',
    label: 'Potansiyel değil',
    color: 'text-stone-400',
    borderColor: 'border-stone-500/30',
    bgLight: 'bg-stone-500/10',
    accentColor: '#78716c',
  },
  QUALIFIED: {
    id: 'QUALIFIED',
    label: 'Nitelikli',
    color: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    bgLight: 'bg-teal-500/10',
    accentColor: '#2dd4bf',
  },
  APPOINTMENT: {
    id: 'APPOINTMENT',
    label: 'Teklif',
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgLight: 'bg-indigo-500/10',
    accentColor: '#818cf8',
  },
  PRESENTATION: {
    id: 'PRESENTATION',
    label: 'Teklif',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgLight: 'bg-purple-500/10',
    accentColor: '#c084fc',
  },
  OFFER: {
    id: 'OFFER',
    label: 'Teklif',
    color: 'text-brand-gold',
    borderColor: 'border-brand-gold/40',
    bgLight: 'bg-brand-gold/10',
    accentColor: '#dfb76c',
  },
  WON: {
    id: 'WON',
    label: 'Dönüşüm',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgLight: 'bg-emerald-500/10',
    accentColor: '#34d399',
  },
  LOST: {
    id: 'LOST',
    label: 'Potansiyel değil',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgLight: 'bg-rose-500/10',
    accentColor: '#f43f5e',
  },
}

export type LeadSource = 'META_ADS' | 'GOOGLE_ADS' | 'INSTAGRAM' | 'FACEBOOK' | 'REFERRAL' | 'DIRECT' | 'WEBSITE' | 'WHATSAPP'

export interface MetaAnswer {
  question: string
  answer: string
}

export interface CustomerInquiry {
  metaWarnings?: string[]
  metaFormId?: string
  metaPageId?: string
  metaAdId?: string
  metaAdName?: string
  metaAdsetId?: string
  metaAdsetName?: string
  metaCampaignId?: string
  metaPlatform?: string
  metaIsOrganic?: boolean
  id: string
  formName: string
  campaignName?: string
  source: LeadSource
  channel: string
  metaLeadgenId?: string
  budget?: number
  preferredHousingType?: string
  notes?: string
  metaAnswers?: MetaAnswer[]
  createdAt: string
}

export interface AssignmentHistoryEntry {
  id: string
  assignedToUserId: string
  assignedToUserName: string
  assignedByUserId: string
  assignedByUserName: string
  assignedByDepartment?: string
  assignedAt: string
  note?: string
  isSalesHandover?: boolean
}

export interface StageHistoryEntry {
  id: string
  fromStage?: LeadStage
  toStage: LeadStage
  changedByUserId: string
  changedByUserName: string
  changedAt: string
  note?: string
}

export interface AiEvaluation {
  suggestion: string
  confidence: number
  rationale: string
  humanVerified: boolean
  verifiedByUserId?: string
  verifiedByUserName?: string
  verifiedAt?: string
}

export interface LeadActivity {
  id: string
  leadId: string
  type: 'CALL' | 'WHATSAPP' | 'NOTE' | 'STAGE_CHANGE' | 'ASSIGNMENT' | 'QUALIFICATION' | 'META_CAPI'
  content: string
  author: string
  createdAt: string
}

export interface LeadMetaCapiStatus {
  metaLeadgenId?: string
  revision?: number
  lastEventName: string
  label: string
  sentAt: string
  status: 'SENT' | 'QUEUED' | 'FAILED'
  fbtraceId?: string
  errorMessage?: string
}

export interface Lead {
  metaRevision?: number
  id: string
  leadNumber?: number
  companyName?: string
  fullName: string
  phone: string
  secondaryPhone?: string
  whatsappPhone?: string
  email?: string
  source: LeadSource
  formName: string
  channel: string
  stage: LeadStage
  callStatus?: CallCenterStatus | string
  owner: string
  tags: string[]
  budget?: number
  preferredHousingType?: string
  notes?: string
  metaLeadId?: string
  metaCapiStatus?: LeadMetaCapiStatus

  // Enterprise Unified Customer Pool Extensions
  assignedToUserId?: string
  assignedToUserName?: string
  inquiries?: CustomerInquiry[]
  assignmentHistory?: AssignmentHistoryEntry[]
  stageHistory?: StageHistoryEntry[]
  aiEvaluation?: AiEvaluation
  isQualified?: boolean
  qualifiedByUserName?: string
  qualifiedAt?: string
  metaAnswers?: MetaAnswer[]

  // Manual Sales Handover (Only Müşteri İlişkileri, Pazarlama, or Yönetim can set this)
  handedOverToSales?: boolean
  handedOverToSalesAt?: string
  handedOverToSalesByUserId?: string
  handedOverToSalesByUserName?: string
  handedOverToSalesByDepartment?: string
  salesRepUserId?: string
  salesRepUserName?: string

  createdAt: string
  updatedAt: string
}

/**
 * Hiçbir veri (Potansiyel müşteri, Web sitesi, Google, Meta vb.) Müşteri İlişkileri,
 * Pazarlama veya Yönetim tarafından manuel olarak "Satışa İlet" denmedikçe Satışa devredilemez.
 */
export function isLeadHandedOverToSales(lead?: Lead | null): boolean {
  if (!lead) return false
  if (typeof lead.handedOverToSales === 'boolean') {
    return lead.handedOverToSales
  }
  const latestHandover = lead.assignmentHistory?.find(
    (h) => h && typeof h.isSalesHandover === 'boolean'
  )
  return Boolean(latestHandover?.isSalesHandover === true)
}

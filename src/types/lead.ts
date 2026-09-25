export type LeadStage =
  | 'NEW'             // Giriş / Yeni Başvuru (Pazarlama / Web / Doğrudan)
  | 'CONTACTED'       // İletişime Geçildi (Müşteri İlişkileri Görüşmesi)
  | 'QUALIFIED'       // Nitelikli Müşteri (Müşteri İlişkileri Tarafından Onaylandı)
  | 'APPOINTMENT'     // Randevu Alındı (Satış Temsilcisi ile)
  | 'PRESENTATION'    // Portföy / Proje Sunumu Yapıldı
  | 'OFFER'           // Teklif / Rezervasyon Aşamasında
  | 'WON'             // Satış / Anlaşma (Muhasebeye Tahsilat Aktarımı)
  | 'LOST'            // Olumsuz / Pasif

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
    label: 'Giriş (Yeni)',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgLight: 'bg-amber-500/10',
    accentColor: '#f59e0b',
  },
  CONTACTED: {
    id: 'CONTACTED',
    label: 'İletişime Geçildi',
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgLight: 'bg-sky-500/10',
    accentColor: '#38bdf8',
  },
  QUALIFIED: {
    id: 'QUALIFIED',
    label: 'Nitelikli Aday',
    color: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    bgLight: 'bg-teal-500/10',
    accentColor: '#2dd4bf',
  },
  APPOINTMENT: {
    id: 'APPOINTMENT',
    label: 'Randevu Alındı',
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgLight: 'bg-indigo-500/10',
    accentColor: '#818cf8',
  },
  PRESENTATION: {
    id: 'PRESENTATION',
    label: 'Portföy Sunumu',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgLight: 'bg-purple-500/10',
    accentColor: '#c084fc',
  },
  OFFER: {
    id: 'OFFER',
    label: 'Teklif Aşamasında',
    color: 'text-brand-gold',
    borderColor: 'border-brand-gold/40',
    bgLight: 'bg-brand-gold/10',
    accentColor: '#dfb76c',
  },
  WON: {
    id: 'WON',
    label: 'Anlaşma / Satış',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgLight: 'bg-emerald-500/10',
    accentColor: '#34d399',
  },
  LOST: {
    id: 'LOST',
    label: 'Olumsuz / Pasif',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgLight: 'bg-rose-500/10',
    accentColor: '#f43f5e',
  },
}

export type LeadSource = 'META_ADS' | 'INSTAGRAM' | 'FACEBOOK' | 'REFERRAL' | 'DIRECT' | 'WEBSITE'

export interface CustomerInquiry {
  id: string
  formName: string
  campaignName?: string
  source: LeadSource
  channel: string
  metaLeadgenId?: string
  budget?: number
  preferredHousingType?: string
  notes?: string
  createdAt: string
}

export interface AssignmentHistoryEntry {
  id: string
  assignedToUserId: string
  assignedToUserName: string
  assignedByUserId: string
  assignedByUserName: string
  assignedAt: string
  note?: string
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
  suggestion: string // e.g. "Yüksek Yatırım Potansiyeli", "2+1 Daire İlgisi"
  confidence: number // 0 - 100
  rationale: string
  humanVerified: boolean
  verifiedByUserId?: string
  verifiedByUserName?: string
  verifiedAt?: string
}

export interface LeadActivity {
  id: string
  leadId: string
  type: 'CALL' | 'WHATSAPP' | 'NOTE' | 'STAGE_CHANGE' | 'ASSIGNMENT' | 'QUALIFICATION'
  content: string
  author: string
  createdAt: string
}

export interface Lead {
  id: string
  fullName: string
  phone: string
  secondaryPhone?: string
  whatsappPhone?: string
  email?: string
  source: LeadSource
  formName: string
  channel: string
  stage: LeadStage
  owner: string // Legacy or display owner name
  tags: string[]
  budget?: number
  preferredHousingType?: string
  notes?: string
  
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
  
  createdAt: string
  updatedAt: string
}

export interface MetaFormSummary {
  id: string
  name: string
  campaignName: string
  leadCount: number
  conversionRate: number
  status: 'ACTIVE' | 'PAUSED'
  lastLeadAt: string
}

export interface MetaWebhookEvent {
  id: string
  receivedAt: string
  formName: string
  leadName: string
  phone: string
  payloadRaw: Record<string, any>
  status: 'PROCESSED' | 'PENDING'
}

export type MetaCapiEventName =
  | 'Lead'
  | 'Contact'
  | 'QualifiedLead'
  | 'DisqualifiedLead'
  | 'Schedule'
  | 'Purchase'

export interface MetaCapiEventLog {
  id: string
  leadId: string
  leadName: string
  phone: string
  metaLeadId?: string
  eventName: MetaCapiEventName
  signalLabel: string
  stage: string
  sentAt: string
  status: 'SENT' | 'QUEUED' | 'FAILED'
  eventsReceived?: number
  fbtraceId?: string
  errorMessage?: string
  payloadPreview: Record<string, any>
}

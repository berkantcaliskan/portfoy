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

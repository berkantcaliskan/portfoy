import { MetaFormSummary, MetaWebhookEvent } from '@/types/meta'
import { leadStore } from './leadStore'

const INITIAL_FORMS: MetaFormSummary[] = [
  {
    id: 'form-101',
    name: 'DMTRK | 1Q KONUT TİPİ | HIGH VOLUME | V1',
    campaignName: 'Demirtürk Rezidans 2026 Q3 Kampanyası',
    leadCount: 42,
    conversionRate: 18.5,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'form-102',
    name: 'DMTRK | 2Q HYBRID | HIGH INTENT | V1',
    campaignName: 'Demirtürk Panorama & Lüks Konutlar',
    leadCount: 28,
    conversionRate: 26.2,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'form-103',
    name: 'DMTRK | VILLA VIP COLLECTION | LEAD GEN',
    campaignName: 'Ege & Akdeniz Müstakil Villa Portföyü',
    leadCount: 14,
    conversionRate: 35.7,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
]

type Listener = () => void

class MetaStore {
  private forms: MetaFormSummary[] = INITIAL_FORMS
  private webhookLogs: MetaWebhookEvent[] = [
    {
      id: 'wh-1',
      receivedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      formName: 'DMTRK | 1Q KONUT TİPİ | HIGH VOLUME | V1',
      leadName: 'Ahmet Ulucak',
      phone: '+905426064258',
      payloadRaw: { form_id: '101', ad_id: '238510928391', platform: 'ig' },
      status: 'PROCESSED',
    },
    {
      id: 'wh-2',
      receivedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      formName: 'DMTRK | 2Q HYBRID | HIGH INTENT | V1',
      leadName: 'Murat Şahin',
      phone: '+905397348020',
      payloadRaw: { form_id: '102', ad_id: '238510928400', platform: 'fb' },
      status: 'PROCESSED',
    }
  ]
  private listeners: Set<Listener> = new Set()

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getForms(): MetaFormSummary[] {
    return [...this.forms]
  }

  public getWebhookLogs(): MetaWebhookEvent[] {
    return [...this.webhookLogs]
  }

  /**
   * Simulate or process incoming Meta Webhook event
   */
  public simulateIncomingLead(leadData: {
    fullName: string
    phone: string
    email?: string
    formName: string
    budget?: number
    preferredHousingType?: string
  }) {
    // 1. Add lead to leadStore
    const newLead = leadStore.add({
      fullName: leadData.fullName,
      phone: leadData.phone,
      whatsappPhone: leadData.phone,
      email: leadData.email,
      source: 'META_ADS',
      formName: leadData.formName,
      channel: 'Instagram / Facebook',
      stage: 'NEW',
      owner: 'Demir Danışmanlık',
      tags: ['Canlı Meta Webhook', leadData.preferredHousingType || 'Konut'],
      budget: leadData.budget,
      preferredHousingType: leadData.preferredHousingType,
      notes: `Meta Ads Formu (${leadData.formName}) üzerinden canlı webhook ile kaydedildi.`,
    })

    // 2. Add to webhook logs
    const event: MetaWebhookEvent = {
      id: 'wh-' + Date.now(),
      receivedAt: new Date().toISOString(),
      formName: leadData.formName,
      leadName: leadData.fullName,
      phone: leadData.phone,
      payloadRaw: {
        leadgen_id: 'leadgen_' + Date.now(),
        page_id: 'demirturk_portfoy',
        form_id: leadData.formName,
        created_time: Date.now(),
      },
      status: 'PROCESSED',
    }
    this.webhookLogs = [event, ...this.webhookLogs]

    // 3. Update form stats
    const targetForm = this.forms.find(f => f.name === leadData.formName)
    if (targetForm) {
      targetForm.leadCount += 1
      targetForm.lastLeadAt = new Date().toISOString()
    }

    this.listeners.forEach(cb => cb())
    return newLead
  }
}

export const metaStore = new MetaStore()

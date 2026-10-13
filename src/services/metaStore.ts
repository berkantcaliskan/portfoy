import { MetaFormSummary, MetaWebhookEvent } from '@/types/meta'
import { leadStore } from './leadStore'

const INITIAL_FORMS: MetaFormSummary[] = [
  {
    id: '1136252376014028',
    name: 'DMTRK | 2Q HYBRID | HIGH INTENT | V1',
    campaignName: 'Demirtürk Rezidans & Konut Kampanyası',
    leadCount: 42,
    conversionRate: 28.5,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: '3247942948721728',
    name: 'DMTRK | 1Q KONUT TİPİ | HIGH VOLUME | V1 (v5)',
    campaignName: 'Demirtürk Panorama & Lüks Konutlar',
    leadCount: 56,
    conversionRate: 24.2,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: '1842764246701203',
    name: 'DMTRK | 3Q QUALITY VOLUME | V1',
    campaignName: 'Demirtürk Prestij Yatırım Portföyü',
    leadCount: 31,
    conversionRate: 35.7,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: '2270503660431344',
    name: 'DMTRK | APPOINTMENT | HIGH INTENT | V1',
    campaignName: 'Lansman Özel Birebir Randevu',
    leadCount: 19,
    conversionRate: 41.2,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: '2991794174546078',
    name: 'Tutan Form',
    campaignName: 'Demirtürk Genel Tanıtım Formu',
    leadCount: 68,
    conversionRate: 22.0,
    status: 'ACTIVE',
    lastLeadAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

export interface MetaApiConfig {
  pageAccessToken: string
  verifyToken: string
  webhookUrl: string
  pageId: string
  pageName: string
  isConnected: boolean
  lastCheckedAt?: string
}

const STORAGE_KEY_META_CONFIG = 'demirturk_meta_api_config'

const DEFAULT_META_CONFIG: MetaApiConfig = {
  pageAccessToken: 'EAAVklAd7ZA50BSgMAsXsdDnjGw5aBK83kmLrm3n2TgXxHttpPsxxsFElZAwL43ZCxUqOz2lIAKIWHf15s6c9dFiAZA7zrPKvJAuiwu3VbhyvZCmymV4xiMsSfdxSklrezLCFWtxTyicgzgSLsSBX3kCLZAIZA8baAEa0VXtGZCFVzZBNcjLz4XxZBTXOwIjY2vvE4rmsyMZBfoBlkxfhbKYwQCQIJGRpJJVCN3QITluS5mg8W4ZD',
  verifyToken: 'demirturk_meta_token_secure_2026',
  webhookUrl: 'https://unjfqfservizfmbgofhq.supabase.co/functions/v1/meta-webhook',
  pageId: '607978645738752',
  pageName: 'Demirtürk İnşaat',
  isConnected: true,
}

type Listener = () => void

class MetaStore {
  private forms: MetaFormSummary[] = INITIAL_FORMS
  private config: MetaApiConfig = this.loadConfig()
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

  private loadConfig(): MetaApiConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_META_CONFIG)
      return saved ? { ...DEFAULT_META_CONFIG, ...JSON.parse(saved) } : DEFAULT_META_CONFIG
    } catch {
      return DEFAULT_META_CONFIG
    }
  }

  public getConfig(): MetaApiConfig {
    return { ...this.config }
  }

  public saveConfig(newConfig: Partial<MetaApiConfig>) {
    this.config = { ...this.config, ...newConfig }
    try {
      localStorage.setItem(STORAGE_KEY_META_CONFIG, JSON.stringify(this.config))
    } catch {}
    this.notify()
  }

  public async testConnection(token: string): Promise<{ success: boolean; pageName?: string; error?: string }> {
    if (!token || token.trim().length < 10) {
      return { success: false, error: 'Lütfen geçerli bir Meta Page Access Token girin.' }
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token.trim()}`)
      if (res.ok) {
        const data = await res.json()
        const pageName = data.name || 'Demirtürk Sayfası'
        this.saveConfig({ pageAccessToken: token.trim(), isConnected: true, pageName, lastCheckedAt: new Date().toISOString() })
        return { success: true, pageName }
      } else {
        const errData = await res.json().catch(() => ({}))
        const errorMsg = errData?.error?.message || 'Meta API doğrulanamadı. Token süresi dolmuş veya yetkileri eksik olabilir.'
        return { success: false, error: errorMsg }
      }
    } catch {
      this.saveConfig({ pageAccessToken: token.trim(), isConnected: true, lastCheckedAt: new Date().toISOString() })
      return { success: true, pageName: this.config.pageName }
    }
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
    campaignName?: string
    budget?: number
    preferredHousingType?: string
    investmentPurpose?: string
    moveInTiming?: string
    metaAnswers?: { question: string; answer: string }[]
  }) {
    const targetForm = this.forms.find(f => f.name === leadData.formName)
    const campaignName = leadData.campaignName || targetForm?.campaignName || 'Demirtürk Rezidans & Villa Lansmanı'

    const answers = leadData.metaAnswers || [
      { question: 'İlgilendiğiniz Konut Tipi', answer: leadData.preferredHousingType || '2+1 Rezidans' },
      { question: 'Bütçe Aralığınız', answer: leadData.budget ? leadData.budget.toLocaleString('tr-TR') + ' TL' : '7.500.000 TL - 10.000.000 TL' },
      { question: 'Alım Amacınız', answer: leadData.investmentPurpose || 'Yatırım & Yüksek Kira Getirisi' },
      { question: 'Taşınma / Satın Alma Süresi', answer: leadData.moveInTiming || 'Hemen (1-3 Ay İçinde)' },
      { question: 'Ödeme Tercihiniz', answer: 'Peşin + Lansman Esnek Vadeli Plan' },
    ]

    // 1. Add lead to leadStore using unified intake
    const result = leadStore.addOrMergeInquiry({
      fullName: leadData.fullName,
      phone: leadData.phone,
      whatsappPhone: leadData.phone,
      email: leadData.email || `${leadData.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
      source: 'META_ADS',
      formName: leadData.formName,
      campaignName,
      channel: 'Instagram Lead Ad',
      budget: leadData.budget,
      preferredHousingType: leadData.preferredHousingType,
      metaAnswers: answers,
      notes: `Meta Ads Formu (${leadData.formName}) üzerinden canlı webhook ile kaydedildi. Müşteri yanıtları incelenebilir.`,
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
        campaign_name: campaignName,
        form_name: leadData.formName,
        field_data: [
          { name: 'full_name', values: [leadData.fullName] },
          { name: 'phone_number', values: [leadData.phone] },
          { name: 'email', values: [leadData.email || ''] },
          ...answers.map(a => ({ name: a.question, values: [a.answer] })),
        ],
        created_time: Date.now(),
      },
      status: 'PROCESSED',
    }
    this.webhookLogs = [event, ...this.webhookLogs]

    // 3. Update form stats
    if (targetForm) {
      targetForm.leadCount += 1
      targetForm.lastLeadAt = new Date().toISOString()
    }

    this.listeners.forEach(cb => cb())
    return result.lead
  }
}

export const metaStore = new MetaStore()

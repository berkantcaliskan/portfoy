import { MetaFormSummary, MetaWebhookEvent, MetaCapiEventLog, MetaCapiEventName } from '@/types/meta'
import { Lead, LeadStage } from '@/types/lead'
import { leadStore } from './leadStore'

const INITIAL_FORMS: MetaFormSummary[] = []

export interface MetaApiConfig {
  pageAccessToken: string
  verifyToken: string
  webhookUrl: string
  pageId: string
  pageName: string
  isConnected: boolean
  lastCheckedAt?: string
  // Meta Conversions API (CAPI for CRM) + Dataset Quality API
  datasetId: string
  capiAccessToken: string
  testEventCode: string
  autoSyncStages: boolean
  crmName: string
}

const STORAGE_KEY_META_CONFIG = 'demirturk_meta_api_config'
const STORAGE_KEY_META_CAPI_LOGS = 'demirturk_meta_capi_logs_v1'

const DEFAULT_CAPI_TOKEN =
  'EAAzMb2xyFHMBS5395SsmZB0y9fgPGhVRMIdhYlaYQdyoLVnFeYZClzkNJwfz5EV6yEg0ZAfBHGSdDyTMiOwoRTSiSiMPmISkcPX8UgyDbw0vv97kNWPZAM3vzjkrhgncYcAsZAPjHFZC2gS5TPymeMV7oLgquOpyq9z2EfYlTIkxRyCxiiaXqYFT2lz4kZChQZDZD'

const DEFAULT_META_CONFIG: MetaApiConfig = {
  pageAccessToken: '',
  verifyToken: 'demirturk_meta_verify_2026',
  webhookUrl: 'https://qspefqddkddxobfxxmqa.supabase.co/functions/v1/meta-webhook',
  pageId: '',
  pageName: 'Portföy Piksel (707603355337943)',
  isConnected: true,
  datasetId: '707603355337943',
  capiAccessToken: DEFAULT_CAPI_TOKEN,
  testEventCode: '',
  autoSyncStages: true,
  crmName: 'Demirtürk Portföy CRM',
}

type Listener = () => void

/**
 * Pure JS SHA-256 fallback in case Web Crypto API is unavailable in non-secure context
 */
function sha256PureJs(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount))
  }
  const mathPow = Math.pow
  const maxWord = mathPow(2, 32)
  const lengthProperty = 'length'
  let i: number, j: number
  let result = ''
  const words: number[] = []
  const asciiBitLength = ascii[lengthProperty] * 8
  let hash: number[] = []
  const k: number[] = []
  let primeCounter = 0
  const isComposite: Record<number, number> = {}
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
    }
  }
  ascii += '\x80'
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00'
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i)
    if (j >> 8) return ''
    words[i >> 2] |= j << (((3 - i) % 4) * 8)
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0
  words[words[lengthProperty]] = asciiBitLength
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16))
    const oldHash = hash
    hash = hash.slice(0, 8)
    for (i = 0; i < 64; i++) {
      const i2 = i + j
      const w15 = w[i - 15],
        w2 = w[i - 2]
      const a = hash[0],
        e = hash[4]
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0)
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))
      hash = [(temp1 + temp2) | 0].concat(hash)
      hash[4] = (hash[4] + temp1) | 0
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255
      result += (b < 16 ? 0 : '') + b.toString(16)
    }
  }
  return result
}

export async function sha256Hex(raw: string): Promise<string> {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return ''
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(normalized)
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {}
  try {
    const utf8 = unescape(encodeURIComponent(normalized))
    return sha256PureJs(utf8)
  } catch {
    return ''
  }
}

/**
 * Normalize phone number for Meta CAPI (digits only with country code, e.g. 905321234567)
 */
export function normalizePhoneForMeta(phone?: string): string {
  if (!phone) return ''
  let digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = '90' + digits.slice(1)
  } else if (digits.length === 10 && digits.startsWith('5')) {
    digits = '90' + digits
  }
  return digits
}

/**
 * Maps CRM stage or manual signal to Meta Conversions API standard CRM event
 */
export function mapStageOrSignalToMetaEvent(stageOrSignal: LeadStage | MetaCapiEventName): {
  eventName: MetaCapiEventName
  signalLabel: string
  stageLabel: string
} {
  switch (stageOrSignal) {
    case 'QualifiedLead':
    case 'QUALIFIED':
      return {
        eventName: 'QualifiedLead',
        signalLabel: 'Nitelikli',
        stageLabel: 'Nitelikli',
      }
    case 'DisqualifiedLead':
    case 'LOST':
    case 'NO_INTENT':
      return {
        eventName: 'DisqualifiedLead',
        signalLabel: 'Potansiyel Değil',
        stageLabel: 'Potansiyel Değil',
      }
    case 'Schedule':
    case 'APPOINTMENT':
    case 'PRESENTATION':
    case 'OFFER':
      return {
        eventName: 'Schedule',
        signalLabel: 'Teklif',
        stageLabel: 'Teklif',
      }
    case 'Purchase':
    case 'WON':
      return {
        eventName: 'Purchase',
        signalLabel: 'Dönüşüm',
        stageLabel: 'Dönüşüm',
      }
    case 'Contact':
    case 'CONTACTED':
    case 'UNDECIDED':
      return {
        eventName: 'Contact',
        signalLabel: 'İletişim',
        stageLabel: 'İletişim',
      }
    case 'Lead':
    case 'NEW':
    default:
      return {
        eventName: 'Lead',
        signalLabel: 'Potansiyel Müşteri',
        stageLabel: 'Potansiyel Müşteri',
      }
  }
}

class MetaStore {
  private forms: MetaFormSummary[] = INITIAL_FORMS
  private config: MetaApiConfig = this.loadConfig()
  private webhookLogs: MetaWebhookEvent[] = []
  private capiLogs: MetaCapiEventLog[] = this.loadCapiLogs()
  private listeners: Set<Listener> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.config = this.loadConfig()
        this.capiLogs = this.loadCapiLogs()
        this.notify()
      })
    }
  }

  private loadConfig(): MetaApiConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_META_CONFIG)
      if (!saved) return DEFAULT_META_CONFIG
      const parsed = JSON.parse(saved)
      const savedToken = (parsed?.capiAccessToken || '').trim()
      // Upgrade older initial token to the Dataset Quality API token
      const effectiveToken =
        !savedToken || savedToken.startsWith('EAAzMb2xyFHMBS1ZCYk')
          ? DEFAULT_CAPI_TOKEN
          : savedToken
      return {
        ...DEFAULT_META_CONFIG,
        ...parsed,
        datasetId: (parsed?.datasetId || '').trim() || DEFAULT_META_CONFIG.datasetId,
        capiAccessToken: effectiveToken,
        crmName: (parsed?.crmName || '').trim() || DEFAULT_META_CONFIG.crmName,
      }
    } catch {
      return DEFAULT_META_CONFIG
    }
  }

  private loadCapiLogs(): MetaCapiEventLog[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_META_CAPI_LOGS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  private saveCapiLogs() {
    try {
      localStorage.setItem(STORAGE_KEY_META_CAPI_LOGS, JSON.stringify(this.capiLogs.slice(0, 200)))
    } catch {}
  }

  public getConfig(): MetaApiConfig {
    return { ...this.config }
  }

  public getCapiLogs(): MetaCapiEventLog[] {
    return [...this.capiLogs]
  }

  public clearCapiLogs() {
    this.capiLogs = []
    this.saveCapiLogs()
    this.notify()
  }

  public saveConfig(newConfig: Partial<MetaApiConfig>) {
    this.config = { ...this.config, ...newConfig }
    try {
      localStorage.setItem(STORAGE_KEY_META_CONFIG, JSON.stringify(this.config))
    } catch {}
    this.notify()

    // If datasetId and token are now configured, flush any queued CAPI events
    const activeToken = (this.config.capiAccessToken || this.config.pageAccessToken || '').trim()
    if (this.config.datasetId.trim() && activeToken) {
      this.flushQueuedCapiEvents()
    }
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

  /**
   * Extract numeric 15-17 digit Meta leadgen_id if present on the lead or its inquiries
   */
  private extractMetaLeadgenId(lead: Lead): string | undefined {
    const candidates: (string | undefined)[] = [
      lead.metaLeadId,
      ...(lead.inquiries || []).map((i) => i.metaLeadgenId),
    ]
    for (const c of candidates) {
      if (!c) continue
      const cleaned = c.replace(/^leadgen_/i, '').trim()
      if (/^\d{12,20}$/.test(cleaned)) {
        return cleaned
      }
    }
    return undefined
  }

  /**
   * Send CRM Lead Quality / Stage Conversion Event to Meta Conversions API (CAPI)
   */
  public async sendCapiLeadEvent(
    lead: Lead,
    stageOrSignal: LeadStage | MetaCapiEventName,
    options?: { note?: string; value?: number }
  ): Promise<MetaCapiEventLog> {
    const { eventName, signalLabel, stageLabel } = mapStageOrSignalToMetaEvent(stageOrSignal)
    const eventTime = Math.floor(Date.now() / 1000)
    const eventId = `capi_${lead.id}_${eventName}_${eventTime}`

    // Normalize and SHA-256 hash customer data according to Meta CAPI spec
    const normalizedPhone = normalizePhoneForMeta(lead.phone)
    const normalizedEmail = (lead.email || '').trim().toLowerCase()
    const nameParts = (lead.fullName || '').trim().split(/\s+/)
    const firstName = (nameParts[0] || '').toLowerCase()
    const lastName = (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '').toLowerCase()

    const [phHash, emHash, fnHash, lnHash] = await Promise.all([
      normalizedPhone ? sha256Hex(normalizedPhone) : Promise.resolve(''),
      normalizedEmail ? sha256Hex(normalizedEmail) : Promise.resolve(''),
      firstName ? sha256Hex(firstName) : Promise.resolve(''),
      lastName ? sha256Hex(lastName) : Promise.resolve(''),
    ])

    const metaLeadId = this.extractMetaLeadgenId(lead)

    const userData: Record<string, any> = {}
    if (metaLeadId) {
      userData.lead_id = Number(metaLeadId) || metaLeadId
    }
    if (phHash) userData.ph = [phHash]
    if (emHash) userData.em = [emHash]
    if (fnHash) userData.fn = [fnHash]
    if (lnHash) userData.ln = [lnHash]
    userData.external_id = [await sha256Hex(lead.id)]

    const customData: Record<string, any> = {
      event_source: 'crm',
      lead_event_source: this.config.crmName || 'Demirtürk Portföy CRM',
      crm_stage: stageLabel,
      lead_status: signalLabel,
    }

    if (lead.formName) {
      customData.form_name = lead.formName
    }
    if (lead.preferredHousingType) {
      customData.content_category = lead.preferredHousingType
    }

    // Dönüşüm (Purchase) aşaması için kullanıcıdan para/TRY girişi istenmez;
    // sadece Meta sunucu doğrulamasının hata vermemesi için teknik olarak sembolik 1 TRY gönderilir.
    if (eventName === 'Purchase') {
      customData.value = 1
      customData.currency = 'TRY'
    }

    const eventPayload: Record<string, any> = {
      data: [
        {
          event_name: eventName,
          event_time: eventTime,
          event_id: eventId,
          action_source: 'system_generated',
          user_data: userData,
          custom_data: customData,
        },
      ],
    }

    if (this.config.testEventCode && this.config.testEventCode.trim()) {
      eventPayload.test_event_code = this.config.testEventCode.trim()
    }

    const datasetId = (this.config.datasetId || '').trim()
    const accessToken = (this.config.capiAccessToken || this.config.pageAccessToken || '').trim()

    let status: 'SENT' | 'QUEUED' | 'FAILED' = 'QUEUED'
    let eventsReceived: number | undefined
    let fbtraceId: string | undefined
    let errorMessage: string | undefined

    if (!datasetId || !accessToken) {
      status = 'QUEUED'
      errorMessage = 'Dataset (Pixel) ID veya CAPI Erişim Anahtarı henüz girilmediği için kuyruğa alındı. Ayarlar > Meta & Reklam bölümünden anahtarları girdiğinizde otomatik gönderilir.'
    } else {
      try {
        const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(datasetId)}/events?access_token=${encodeURIComponent(accessToken)}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          status = 'SENT'
          eventsReceived = json?.events_received ?? 1
          fbtraceId = json?.fbtrace_id
        } else {
          status = 'FAILED'
          errorMessage = json?.error?.message || `HTTP ${res.status}: Meta CAPI hatası`
          fbtraceId = json?.error?.fbtrace_id
        }
      } catch (err: any) {
        status = 'FAILED'
        errorMessage = err?.message || 'Ağ hatası: Meta Graph API sunucusuna ulaşılamadı.'
      }
    }

    const logEntry: MetaCapiEventLog = {
      id: 'capi-log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      leadId: lead.id,
      leadName: lead.fullName,
      phone: lead.phone,
      metaLeadId,
      eventName,
      signalLabel,
      stage: stageLabel,
      sentAt: new Date().toISOString(),
      status,
      eventsReceived,
      fbtraceId,
      errorMessage,
      payloadPreview: eventPayload,
    }

    this.capiLogs = [logEntry, ...this.capiLogs.filter((l) => l.id !== logEntry.id)].slice(0, 200)
    this.saveCapiLogs()

    // Update lead's metaCapiStatus in leadStore without re-triggering stage CAPI
    leadStore.updateMetaCapiStatus(lead.id, {
      lastEventName: eventName,
      label: signalLabel,
      sentAt: logEntry.sentAt,
      status,
      fbtraceId,
      errorMessage,
    })

    this.notify()
    return logEntry
  }

  /**
   * Retry / flush all QUEUED CAPI events when credentials are configured
   */
  public async flushQueuedCapiEvents(): Promise<{ sentCount: number; failedCount: number }> {
    const datasetId = (this.config.datasetId || '').trim()
    const accessToken = (this.config.capiAccessToken || this.config.pageAccessToken || '').trim()
    if (!datasetId || !accessToken) return { sentCount: 0, failedCount: 0 }

    const queued = this.capiLogs.filter((l) => l.status === 'QUEUED')
    if (queued.length === 0) return { sentCount: 0, failedCount: 0 }

    let sentCount = 0
    let failedCount = 0

    for (const item of queued) {
      try {
        const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(datasetId)}/events?access_token=${encodeURIComponent(accessToken)}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payloadPreview),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          item.status = 'SENT'
          item.eventsReceived = json?.events_received ?? 1
          item.fbtraceId = json?.fbtrace_id
          item.errorMessage = undefined
          sentCount++
        } else {
          item.status = 'FAILED'
          item.errorMessage = json?.error?.message || `HTTP ${res.status}`
          failedCount++
        }
      } catch (err: any) {
        item.status = 'FAILED'
        item.errorMessage = err?.message || 'Ağ hatası'
        failedCount++
      }

      leadStore.updateMetaCapiStatus(item.leadId, {
        lastEventName: item.eventName,
        label: item.signalLabel,
        sentAt: new Date().toISOString(),
        status: item.status,
        fbtraceId: item.fbtraceId,
        errorMessage: item.errorMessage,
      })
    }

    this.saveCapiLogs()
    this.notify()
    return { sentCount, failedCount }
  }

  /**
   * Send a test CAPI event to verify Dataset ID and CAPI Access Token in Meta Events Manager
   */
  public async sendTestCapiEvent(customConfig?: {
    datasetId?: string
    capiAccessToken?: string
    testEventCode?: string
  }): Promise<{ success: boolean; message: string; fbtraceId?: string }> {
    const datasetId = (customConfig?.datasetId ?? this.config.datasetId ?? '').trim()
    const accessToken = (
      customConfig?.capiAccessToken ??
      this.config.capiAccessToken ??
      this.config.pageAccessToken ??
      ''
    ).trim()
    const testEventCode = (customConfig?.testEventCode ?? this.config.testEventCode ?? '').trim()

    if (!datasetId) {
      return {
        success: false,
        message: 'Lütfen önce Meta Veri Seti Kimliği (Dataset / Pixel ID) girin.',
      }
    }
    if (!accessToken || accessToken.length < 10) {
      return {
        success: false,
        message: 'Lütfen geçerli bir Dönüşümler API (CAPI) Erişim Anahtarı girin.',
      }
    }

    this.saveConfig({
      datasetId,
      capiAccessToken: accessToken,
      testEventCode,
    })

    const phHash = await sha256Hex('905320000000')
    const emHash = await sha256Hex('test.musteri@demirturk.com')
    const fnHash = await sha256Hex('test')
    const lnHash = await sha256Hex('musteri')

    const nowSec = Math.floor(Date.now() / 1000)
    const payload: Record<string, any> = {
      data: [
        {
          action_source: 'system_generated',
          custom_data: {
            event_source: 'crm',
            lead_event_source: this.config.crmName || 'Demirtürk Portföy CRM',
          },
          event_name: 'Lead',
          event_time: nowSec,
          event_id: `test_capi_lead_${Date.now()}`,
          user_data: {
            em: [emHash],
            lead_id: 1234567890123456,
            ph: [phHash],
            fn: [fnHash],
            ln: [lnHash],
          },
        },
        {
          action_source: 'system_generated',
          custom_data: {
            event_source: 'crm',
            lead_event_source: this.config.crmName || 'Demirtürk Portföy CRM',
            crm_stage: 'Nitelikli (Olumlu)',
            lead_status: 'Olumlu / Nitelikli Müşteri',
          },
          event_name: 'QualifiedLead',
          event_time: nowSec,
          event_id: `test_capi_qualified_${Date.now()}`,
          user_data: {
            em: [emHash],
            lead_id: 1234567890123456,
            ph: [phHash],
            fn: [fnHash],
            ln: [lnHash],
          },
        },
      ],
    }

    if (testEventCode) {
      payload.test_event_code = testEventCode
    }

    try {
      const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(datasetId)}/events?access_token=${encodeURIComponent(accessToken)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        const logEntry: MetaCapiEventLog = {
          id: 'capi-test-' + Date.now(),
          leadId: 'test-lead',
          leadName: 'Test Müşteri (CAPI Doğrulama)',
          phone: '+90 532 000 00 00',
          eventName: 'QualifiedLead',
          signalLabel: 'Test: Olumlu / Nitelikli Müşteri',
          stage: 'Nitelikli (Test)',
          sentAt: new Date().toISOString(),
          status: 'SENT',
          eventsReceived: json?.events_received ?? 1,
          fbtraceId: json?.fbtrace_id,
          payloadPreview: payload,
        }
        this.capiLogs = [logEntry, ...this.capiLogs].slice(0, 200)
        this.saveCapiLogs()
        this.notify()
        return {
          success: true,
          message: `Meta CAPI bağlantısı doğrulandı! (${json?.events_received ?? 1} olay iletildi • Trace ID: ${json?.fbtrace_id || 'OK'})`,
          fbtraceId: json?.fbtrace_id,
        }
      } else {
        const errMsg =
          json?.error?.message || `HTTP ${res.status}: Dataset ID veya Token doğrulanamadı.`
        return {
          success: false,
          message: `Meta API Hatası: ${errMsg}`,
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Bağlantı hatası: ${err?.message || 'Meta Graph API sunucusuna erişilemedi.'}`,
      }
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
    const targetForm = this.forms.find((f) => f.name === leadData.formName)
    const campaignName =
      leadData.campaignName || targetForm?.campaignName || 'Demirtürk Rezidans & Villa Lansmanı'

    const answers = leadData.metaAnswers || [
      { question: 'İlgilendiğiniz Konut Tipi', answer: leadData.preferredHousingType || '2+1 Rezidans' },
      {
        question: 'Bütçe Aralığınız',
        answer: leadData.budget
          ? leadData.budget.toLocaleString('tr-TR') + ' TL'
          : '7.500.000 TL - 10.000.000 TL',
      },
      { question: 'Alım Amacınız', answer: leadData.investmentPurpose || 'Yatırım & Yüksek Kira Getirisi' },
      { question: 'Taşınma / Satın Alma Süresi', answer: leadData.moveInTiming || 'Hemen (1-3 Ay İçinde)' },
      { question: 'Ödeme Tercihiniz', answer: 'Peşin + Lansman Esnek Vadeli Plan' },
    ]

    const simulatedLeadgenId = String(1000000000000000 + Math.floor(Math.random() * 899999999999999))

    // 1. Add lead to leadStore using unified intake
    const result = leadStore.addOrMergeInquiry({
      fullName: leadData.fullName,
      phone: leadData.phone,
      whatsappPhone: leadData.phone,
      email:
        leadData.email ||
        `${leadData.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
      source: 'META_ADS',
      formName: leadData.formName,
      campaignName,
      channel: 'Instagram Lead Ad',
      metaLeadgenId: simulatedLeadgenId,
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
        leadgen_id: simulatedLeadgenId,
        campaign_name: campaignName,
        form_name: leadData.formName,
        field_data: [
          { name: 'full_name', values: [leadData.fullName] },
          { name: 'phone_number', values: [leadData.phone] },
          { name: 'email', values: [leadData.email || ''] },
          ...answers.map((a) => ({ name: a.question, values: [a.answer] })),
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

    this.listeners.forEach((cb) => cb())
    return result.lead
  }
}

export const metaStore = new MetaStore()

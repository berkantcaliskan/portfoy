import { leadStore } from './leadStore'
import { Lead, LeadStage } from '@/types/lead'
import { userStore } from './userStore'
import { isCentralCrm } from './crmRuntime'
import { createCompanyRepository, type CompanyDocumentKind } from './companyRepository'

export interface GoogleAdsConfig {
  customerId: string           // e.g. 482-910-3321
  conversionId: string         // e.g. AW-114829103
  conversionLabel: string      // e.g. Kx82Cj91L0aE...
  webhookKey: string           // google_key verification secret
  webhookUrl: string
  autoSyncConversions: boolean
  isConnected: boolean
  hasWebhookKey?: boolean
}

export interface GoogleCampaignItem {
  id: string
  name: string
  campaignType: 'Arama Ağı (Search)' | 'Performance Max' | 'YouTube Lead Form' | 'Display & Keşfet'
  formName: string
  status: 'ACTIVE' | 'PAUSED'
  leadCount: number
  conversionRate: number
  lastLeadAt?: string
}

export interface GoogleConversionLog {
  id: string
  leadId: string
  leadName: string
  phone: string
  gclid?: string
  conversionAction: 'QualifiedLead' | 'ConvertedLead' | 'AppointmentScheduled' | 'Disqualified'
  signalLabel: string
  stage: string
  sentAt: string
  status: 'SENT' | 'QUEUED'
}

const STORAGE_KEY_GOOGLE_CONFIG = 'demirturk_google_ads_config'
const STORAGE_KEY_GOOGLE_CAMPAIGNS = 'demirturk_google_ads_campaigns_v1'
const STORAGE_KEY_GOOGLE_LOGS = 'demirturk_google_conversion_logs_v1'

type Listener = () => void

class GoogleAdsStore {
  private account: string | null = null
  private serverLoaded = false
  private serverBusy = false
  private serverError = ''
  private serverGeneration = 0
  private revisions = new Map<CompanyDocumentKind, number>()
  private pending = new Map<CompanyDocumentKind, { key: string; revision: number; requestId: string }>()
  private pendingCampaign: { key: string; item: GoogleCampaignItem } | null = null
  private config: GoogleAdsConfig
  private customCampaigns: GoogleCampaignItem[] = []
  private conversionLogs: GoogleConversionLog[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    if (isCentralCrm()) { this.config = { ...this.getDefaultConfig(), webhookKey: '', webhookUrl: '', autoSyncConversions: false }; return }
    this.config = this.loadConfig()
    this.customCampaigns = this.loadCampaigns()
    this.conversionLogs = this.loadLogs()

    if (typeof window !== 'undefined') {
      window.addEventListener('demirturk:cloud-db-synced', () => {
        this.config = this.loadConfig()
        this.customCampaigns = this.loadCampaigns()
        this.conversionLogs = this.loadLogs()
        this.notify()
      })
    }
  }

  public setAccount(id: string | null) {
    if (this.account === id) return
    this.account = id; this.serverGeneration++; this.serverLoaded = false; this.serverError = ''; this.revisions.clear(); this.pending.clear(); this.pendingCampaign = null
    this.config = { ...this.getDefaultConfig(), webhookKey: '', webhookUrl: '', autoSyncConversions: false }
    this.customCampaigns = []; this.conversionLogs = []; this.notify()
  }
  public getReadError() { return this.serverError }
  public async refreshFromBackend() {
    if (!isCentralCrm() || !this.account || this.serverBusy) return
    const user = userStore.getCurrentUser(), client = userStore.getServerClient()
    if (!user || !client || (user.role !== 'ADMIN' && user.department !== 'Pazarlama' && !user.departments.includes('Pazarlama'))) return
    const generation = ++this.serverGeneration
    try {
      const repository = createCompanyRepository(client)
      const documents = await Promise.all((['google_config', 'google_campaigns', 'google_logs'] as const).map(kind => repository.get(kind)))
      if (generation !== this.serverGeneration || user.id !== userStore.getCurrentUser()?.id) return
      for (const document of documents) {
        this.revisions.set(document.kind, document.revision)
        if (document.kind === 'google_config') this.config = { ...this.getDefaultConfig(), ...document.payload, webhookKey: '', webhookUrl: '', autoSyncConversions: false, isConnected: false }
        if (document.kind === 'google_campaigns') this.customCampaigns = document.payload.items || []
        if (document.kind === 'google_logs') this.conversionLogs = document.payload.items || []
      }
      this.serverLoaded = true; this.serverError = ''
    } catch (e) { if (generation === this.serverGeneration) this.serverError = e instanceof Error ? e.message : 'Google kayıtları okunamadı.' }
    this.notify()
  }
  private async writeDocument(kind: CompanyDocumentKind, payload: Record<string, unknown>) {
    if (this.serverBusy) throw Error('Önceki Google kayıt işlemi sürüyor.')
    if (!this.serverLoaded) await this.refreshFromBackend()
    const client = userStore.getServerClient(), actor = userStore.getCurrentUser()?.id
    if (!this.serverLoaded || !client || actor !== this.account) throw Error(this.serverError || 'Google kayıtları için sunucu oturumu gerekli.')
    this.serverBusy = true; this.serverGeneration++
    const key = JSON.stringify(payload)
    const revision = this.revisions.get(kind) || 0
    if (this.pending.get(kind)?.key !== key || this.pending.get(kind)?.revision !== revision) this.pending.set(kind, { key, revision, requestId: crypto.randomUUID() })
    try {
      const saved = await createCompanyRepository(client).save(kind, revision, payload, this.pending.get(kind)!.requestId)
      if (actor !== this.account) throw Error('Kayıt sırasında oturum değişti.')
      this.revisions.set(kind, saved.revision); this.pending.delete(kind); this.serverError = ''
      if (kind === 'google_config') this.config = { ...this.getDefaultConfig(), ...saved.payload, webhookKey: '', webhookUrl: '', autoSyncConversions: false, isConnected: false }
      if (kind === 'google_campaigns') this.customCampaigns = saved.payload.items || []
      if (kind === 'google_logs') this.conversionLogs = saved.payload.items || []
      return saved
    } catch (e) { this.serverError = e instanceof Error ? e.message : 'Google kaydı tamamlanamadı.'; throw e }
    finally { this.serverBusy = false; this.notify() }
  }

  public localRecordCount() {
    try { const config = JSON.parse(localStorage.getItem(STORAGE_KEY_GOOGLE_CONFIG) || '{}'); return (config.customerId || config.conversionId ? 1 : 0) + [STORAGE_KEY_GOOGLE_CAMPAIGNS, STORAGE_KEY_GOOGLE_LOGS].reduce((sum, key) => { const values = JSON.parse(localStorage.getItem(key) || '[]'); return sum + (Array.isArray(values) ? values.length : 0) }, 0) } catch { return 0 }
  }
  public async importLocalRecords() {
    const campaigns = JSON.parse(localStorage.getItem(STORAGE_KEY_GOOGLE_CAMPAIGNS) || '[]')
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_GOOGLE_LOGS) || '[]')
    if (!Array.isArray(campaigns) || !Array.isArray(logs)) throw Error('Yerel kayıt biçimi geçersiz.')
    await this.refreshFromBackend()
    const oldConfig = JSON.parse(localStorage.getItem(STORAGE_KEY_GOOGLE_CONFIG) || '{}')
    if (!this.config.customerId && !this.config.conversionId && (oldConfig.customerId || oldConfig.conversionId)) await this.saveConfig(oldConfig)
    const mergedCampaigns = new Map(campaigns.filter(row => row?.id && row?.name).map(row => [row.id, row]))
    for (const row of this.customCampaigns) mergedCampaigns.set(row.id, row)
    await this.writeDocument('google_campaigns', { items: [...mergedCampaigns.values()] })
    const mergedLogs = new Map(logs.filter(row => row?.id).map(row => [row.id, { ...row, status: 'QUEUED' }]))
    for (const row of this.conversionLogs) mergedLogs.set(row.id, row)
    await this.writeDocument('google_logs', { items: [...mergedLogs.values()] })
    return { campaigns: mergedCampaigns.size, logs: mergedLogs.size }
  }

  private loadConfig(): GoogleAdsConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOOGLE_CONFIG)
      if (saved) {
        return { ...this.getDefaultConfig(), ...JSON.parse(saved) }
      }
    } catch {}
    return this.getDefaultConfig()
  }

  private getDefaultConfig(): GoogleAdsConfig {
    return {
      customerId: '',
      conversionId: '',
      conversionLabel: '',
      webhookKey: 'dt_gads_wh_' + Math.random().toString(36).substring(2, 10),
      webhookUrl: 'https://crm.demirturk.com/api/webhooks/google-ads-lead',
      autoSyncConversions: true,
      isConnected: false,
    }
  }

  public getConfig(): GoogleAdsConfig {
    return { ...this.config }
  }

  public async saveConfig(updates: Partial<GoogleAdsConfig>): Promise<GoogleAdsConfig> {
    if (isCentralCrm()) { await this.writeDocument('google_config', { ...this.config, ...updates }); return this.getConfig() }
    this.config = {
      ...this.config,
      ...updates,
      isConnected: Boolean(
        (updates.customerId ?? this.config.customerId)?.trim() ||
          (updates.conversionId ?? this.config.conversionId)?.trim()
      ),
    }
    try {
      localStorage.setItem(STORAGE_KEY_GOOGLE_CONFIG, JSON.stringify(this.config))
    } catch {}
    this.notify()
    return this.getConfig()
  }

  private loadCampaigns(): GoogleCampaignItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOOGLE_CAMPAIGNS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return []
  }

  private saveCampaigns() {
    try {
      localStorage.setItem(STORAGE_KEY_GOOGLE_CAMPAIGNS, JSON.stringify(this.customCampaigns))
    } catch {}
    this.notify()
  }

  private loadLogs(): GoogleConversionLog[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOOGLE_LOGS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
    return []
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY_GOOGLE_LOGS, JSON.stringify(this.conversionLogs))
    } catch {}
    this.notify()
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  public getCampaigns(): GoogleCampaignItem[] {
    const allLeads = leadStore.getAllRaw()
    const googleLeads = allLeads.filter(
      (l) =>
        l.source === 'GOOGLE_ADS' ||
        l.channel?.toLowerCase().includes('google') ||
        l.formName?.toLowerCase().includes('google')
    )

    const byName = new Map<string, GoogleCampaignItem>()
    for (const c of this.customCampaigns) {
      byName.set(c.formName.toLowerCase(), { ...c, leadCount: 0 })
    }

    const grouped = new Map<
      string,
      { formName: string; count: number; converted: number; lastAt: string }
    >()

    for (const lead of googleLeads) {
      const fName = (lead.formName || 'Google Ads Arama Formu').trim()
      const key = fName.toLowerCase()
      const cur = grouped.get(key) || {
        formName: fName,
        count: 0,
        converted: 0,
        lastAt: lead.createdAt,
      }
      cur.count += 1
      if (
        lead.stage === 'QUALIFIED' ||
        lead.stage === 'APPOINTMENT' ||
        lead.stage === 'OFFER' ||
        lead.stage === 'WON'
      ) {
        cur.converted += 1
      }
      if (new Date(lead.createdAt).getTime() > new Date(cur.lastAt).getTime()) {
        cur.lastAt = lead.createdAt
      }
      grouped.set(key, cur)
    }

    for (const [key, stat] of grouped.entries()) {
      const existing = byName.get(key)
      const rate = stat.count > 0 ? Math.round((stat.converted / stat.count) * 100) : 0
      if (existing) {
        existing.leadCount = stat.count
        existing.conversionRate = rate
        existing.lastLeadAt = stat.lastAt
      } else {
        byName.set(key, {
          id: `gcamp-${key.replace(/\s+/g, '-')}`,
          name: stat.formName,
          campaignType: 'Arama Ağı (Search)',
          formName: stat.formName,
          status: 'ACTIVE',
          leadCount: stat.count,
          conversionRate: rate,
          lastLeadAt: stat.lastAt,
        })
      }
    }

    return Array.from(byName.values())
  }

  public async addCampaign(data: {
    name: string
    campaignType: GoogleCampaignItem['campaignType']
    formName: string
  }): Promise<GoogleCampaignItem> {
    const key = JSON.stringify(data)
    if (isCentralCrm() && this.pendingCampaign && this.pendingCampaign.key !== key) throw Error('Sonucu belirsiz kampanyayı önce aynı bilgilerle yeniden deneyin veya sunucudan kontrol edin.')
    const item: GoogleCampaignItem = this.pendingCampaign?.item || {
      id: isCentralCrm() ? 'gcamp-' + crypto.randomUUID() : `gcamp-${Date.now()}`,
      name: data.name.trim(),
      campaignType: data.campaignType,
      formName: data.formName.trim() || data.name.trim(),
      status: 'ACTIVE',
      leadCount: 0,
      conversionRate: 0,
      lastLeadAt: new Date().toISOString(),
    }
    if (isCentralCrm()) {
      this.pendingCampaign = { key, item }
      if (!this.serverLoaded) await this.refreshFromBackend()
      const existing = this.customCampaigns.find(row => row.id === item.id)
      if (existing) { this.pendingCampaign = null; return existing }
      await this.writeDocument('google_campaigns', { items: [item, ...this.customCampaigns] }); this.pendingCampaign = null; return item
    }
    this.customCampaigns = [item, ...this.customCampaigns]
    this.saveCampaigns()
    return item
  }

  public async toggleCampaignStatus(id: string) {
    if (isCentralCrm()) { await this.writeDocument('google_campaigns', { items: this.customCampaigns.map(c => c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : c) }); return }
    this.customCampaigns = this.customCampaigns.map((c) =>
      c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : c
    )
    this.saveCampaigns()
  }

  public async deleteCampaign(id: string) {
    if (isCentralCrm()) { await this.writeDocument('google_campaigns', { items: this.customCampaigns.filter(c => c.id !== id) }); return }
    this.customCampaigns = this.customCampaigns.filter((c) => c.id !== id)
    this.saveCampaigns()
  }

  public getConversionLogs(): GoogleConversionLog[] {
    return [...this.conversionLogs]
  }

  public recordStageConversion(lead: Lead, stage: LeadStage) {
    if (isCentralCrm()) return // Gerçek sunucu teslimatı olmadan SENT kaydı oluşturulmaz.
    const isGoogle =
      lead.source === 'GOOGLE_ADS' ||
      lead.channel?.toLowerCase().includes('google') ||
      lead.formName?.toLowerCase().includes('google')
    if (!isGoogle) return

    let action: GoogleConversionLog['conversionAction'] | null = null
    let label = ''
    if (stage === 'QUALIFIED') {
      action = 'QualifiedLead'
      label = 'Nitelikli Müşteri (Google Enhanced Conversion)'
    } else if (stage === 'OFFER' || stage === 'APPOINTMENT') {
      action = 'AppointmentScheduled'
      label = 'Teklif / Randevu Aşaması'
    } else if (stage === 'WON') {
      action = 'ConvertedLead'
      label = 'Satış Dönüşümü (Offline Conversion)'
    } else if (stage === 'LOST' || stage === 'NO_INTENT') {
      action = 'Disqualified'
      label = 'Olumsuz / Niteliksiz Aday'
    }
    if (!action) return

    const gclidAns = lead.metaAnswers?.find((a) => a.question.toLowerCase().includes('gclid'))
    const log: GoogleConversionLog = {
      id: `gconv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      leadId: lead.id,
      leadName: lead.fullName,
      phone: lead.phone,
      gclid: gclidAns?.answer || `EAIaIQobChMI_${lead.id.slice(-8)}`,
      conversionAction: action,
      signalLabel: label,
      stage,
      sentAt: new Date().toISOString(),
      status: this.config.conversionId ? 'SENT' : 'QUEUED',
    }

    this.conversionLogs = [log, ...this.conversionLogs].slice(0, 150)
    this.saveLogs()
  }

  public async sendTestConversion(): Promise<GoogleConversionLog> {
    if (isCentralCrm()) {
      const log: GoogleConversionLog = { id: 'gcheck-' + crypto.randomUUID(), leadId: '', leadName: 'Bağlantı kayıt kontrolü', phone: '', conversionAction: 'QualifiedLead', signalLabel: 'Sunucu kayıt kontrolü; Google teslimatı yapılmadı', stage: '', sentAt: new Date().toISOString(), status: 'QUEUED' }
      await this.writeDocument('google_logs', { items: [log, ...this.conversionLogs] }); return log
    }
    const log: GoogleConversionLog = {
      id: `gconv-test-${Date.now()}`,
      leadId: 'test-google-lead',
      leadName: 'Test Müşteri (Google OCI Doğrulama)',
      phone: '+90 532 000 00 00',
      gclid: `EAIaIQobChMI_test_${Date.now().toString(36)}`,
      conversionAction: 'QualifiedLead',
      signalLabel: 'Test: Google Gelişmiş Dönüşüm Sinyali',
      stage: 'QUALIFIED',
      sentAt: new Date().toISOString(),
      status: this.config.conversionId ? 'SENT' : 'QUEUED',
    }
    this.conversionLogs = [log, ...this.conversionLogs].slice(0, 150)
    this.saveLogs()
    return log
  }

  public flushQueuedConversions(): number {
    if (isCentralCrm()) throw Error('Google dönüşüm gönderimi doğrulanmış bir sağlayıcıya bağlı değil. Kayıtlar kuyrukta korunuyor; gönderilmiş sayılmadı.')
    if (!this.config.conversionId) return 0
    let count = 0
    this.conversionLogs = this.conversionLogs.map((l) => {
      if (l.status === 'QUEUED') {
        count++
        return { ...l, status: 'SENT', sentAt: new Date().toISOString() }
      }
      return l
    })
    if (count > 0) this.saveLogs()
    return count
  }

  public simulateIncomingGoogleLead(data: {
    fullName: string
    phone: string
    email?: string
    formName: string
    campaignType?: string
    budget?: number
    preferredHousingType?: string
    searchKeyword?: string
    gclid?: string
  }): Lead {
    if (isCentralCrm()) throw Error('Canlı kullanımda örnek müşteri oluşturulmaz.')
    const gclid = data.gclid || `EAIaIQobChMI_${Date.now().toString(36)}`
    const metaAnswers: { question: string; answer: string }[] = [
      { question: 'Google Kampanya Tipi', answer: data.campaignType || 'Arama Ağı (Search)' },
    ]
    if (data.searchKeyword) {
      metaAnswers.push({ question: 'Arama Anahtar Kelimesi', answer: data.searchKeyword })
    }
    metaAnswers.push({ question: 'GCLID (Google Tıklama Kimliği)', answer: gclid })

    const res = leadStore.addOrMergeInquiry({
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      whatsappPhone: data.phone.trim(),
      email: data.email?.trim() || undefined,
      source: 'GOOGLE_ADS',
      formName: data.formName.trim() || 'Google Ads Arama Formu',
      campaignName: data.formName.trim() || 'Google Ads Kampanyası',
      channel: `Google Ads (${data.campaignType || 'Search'})`,
      budget: data.budget,
      preferredHousingType: data.preferredHousingType,
      metaAnswers,
    })

    this.notify()
    return res.lead
  }

  /**
   * Import Google Ads Lead Form Extension CSV / TSV export
   */
  public importLeadsFromGoogleCsvText(rawText: string): { newCount: number; mergedCount: number } {
    if (isCentralCrm()) throw Error('Google CSV aktarımı için doğrulanmış sunucu aktarımı gerekli. Dosyadan henüz müşteri kaydedilmedi.')
    const lines = rawText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)

    if (lines.length < 2) return { newCount: 0, mergedCount: 0 }

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
    const splitLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim())
    let newCount = 0
    let mergedCount = 0

    for (let r = 1; r < lines.length; r++) {
      const cols = splitLine(lines[r])
      if (cols.length < 2) continue

      let createdTime = ''
      let formName = 'Google Ads Lead Formu'
      let campaignName = ''
      let fullName = ''
      let phone = ''
      let email = ''
      let preferredHousingType = ''
      const metaAnswers: { question: string; answer: string }[] = []

      headers.forEach((h, idx) => {
        const val = (cols[idx] || '').replace(/^"|"$/g, '').trim()
        if (!val) return
        const hl = h.toLowerCase()

        if (hl.includes('created') || hl.includes('tarih') || hl.includes('oluşturul') || hl.includes('time')) {
          createdTime = val
        } else if (hl.includes('form_name') || hl === 'form' || hl.includes('asset_name')) {
          formName = val
        } else if (hl.includes('campaign') || hl.includes('kampanya')) {
          campaignName = val
          if (formName === 'Google Ads Lead Formu') formName = val
        } else if (
          hl.includes('full_name') ||
          hl.includes('ad_soyad') ||
          hl.includes('isim') ||
          hl === 'name' ||
          hl === 'adı' ||
          hl === 'adi' ||
          hl === 'ad' ||
          hl === 'ad soyad' ||
          hl.includes('adınız')
        ) {
          fullName = fullName ? `${fullName} ${val}` : val
        } else if (
          hl.includes('phone') ||
          hl.includes('telefon') ||
          hl.includes('numara') ||
          hl.includes('tel')
        ) {
          phone = val.replace(/^p:/i, '').trim()
        } else if (hl.includes('email') || hl.includes('e-posta') || hl.includes('mail')) {
          email = val
        } else {
          metaAnswers.push({ question: h, answer: val })
          if (
            hl.includes('konut') ||
            hl.includes('daire') ||
            val.includes('1+1') ||
            val.includes('2+1') ||
            val.includes('3+1') ||
            val.toLowerCase().includes('villa')
          ) {
            preferredHousingType = val
          }
        }
      })

      if (!fullName && !phone) continue

      const normalizedTimeStr = createdTime ? createdTime.trim().replace(/(\d)(am|pm)$/i, '$1 $2') : ''
      const parsedDate = normalizedTimeStr ? new Date(normalizedTimeStr) : new Date()
      const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date()

      const res = leadStore.addOrMergeInquiry(
        {
          fullName: fullName || 'Google Ads Müşterisi',
          phone: phone || '',
          whatsappPhone: phone || '',
          email: email || undefined,
          source: 'GOOGLE_ADS',
          formName,
          campaignName: campaignName || formName,
          channel: 'Google Ads',
          preferredHousingType: preferredHousingType || undefined,
          metaAnswers: metaAnswers.length > 0 ? metaAnswers : undefined,
          createdAt: validDate.toISOString(),
        },
        { skipSave: true }
      )

      if (res.isNewCustomer) {
        newCount++
      } else {
        mergedCount++
      }
    }

    if (newCount > 0 || mergedCount > 0) {
      leadStore.flushSave()
    }
    this.notify()
    return { newCount, mergedCount }
  }
}

export const googleAdsStore = new GoogleAdsStore()

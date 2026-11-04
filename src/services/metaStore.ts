import { MetaFormSummary, MetaWebhookEvent, MetaCapiEventLog, MetaCapiEventName } from '@/types/meta'
import { Lead, LeadStage } from '@/types/lead'
import { leadStore } from './leadStore'
import { supabase, SUPABASE_URL } from './supabaseClient'
import { rowToLead } from './dbMapper'
import { MetaStageQueue } from './metaStageQueue'
import { stageEvent } from '../../supabase/functions/_shared/meta-core'
export { normalizePhone as normalizePhoneForMeta, hash as sha256Hex } from '../../supabase/functions/_shared/meta-core'

// Eski ekranlarla tip uyumluluğu; ayrıcalıklı alanlar her zaman boş ve salt okunurdur.
export interface MetaApiConfig {
  pageAccessToken: string; capiAccessToken: string; verifyToken: string
  webhookUrl: string; pageId: string; pageName: string; isConnected: boolean
  datasetId: string; testEventCode: string; autoSyncStages: boolean; crmName: string; lastCheckedAt?: string
}
const DEFAULT_META_CONFIG: MetaApiConfig = {
  pageAccessToken: '', capiAccessToken: '', verifyToken: '',
  webhookUrl: import.meta.env.VITE_SUPABASE_URL ? SUPABASE_URL + '/functions/v1/meta-webhook' : '',
  pageId: '', pageName: 'Sunucuda doğrulama gerekli', isConnected: false,
  datasetId: '', testEventCode: '', autoSyncStages: false, crmName: 'Demirtürk Portföy CRM',
}
export async function invokeMeta(body: Record<string, unknown>) {
  if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('VITE_SUPABASE_URL yapılandırılmamış.')
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) throw new Error('Meta işlemleri için Supabase Auth oturumu gerekli; yerel CRM girişi yeterli değildir.')
  const { data, error } = await supabase.functions.invoke('meta-capi', { body, timeout: 70000 })
  if (error) {
    let message = 'Meta sunucu işlemi başarısız; oturum, yetki ve sunucu ayarlarını kontrol edin.'
    if (error.name === 'FunctionsFetchError' || error.name === 'AbortError') message = 'Sunucuya erişilemedi veya işlem süresi doldu. Bazı kayıtlar işlenmiş olabilir; durumu yenileyip aynı kapsamı güvenle tekrar kontrol edin.'
    if (error.context instanceof Response) {
      const detail = await error.context.clone().json().catch(() => null)
      if (typeof detail?.error === 'string') message = detail.error
    }
    throw new Error(message)
  }
  if (!data || data.error) throw new Error(data?.error || 'Sunucudan geçerli Meta işlem sonucu alınamadı.')
  return data
}
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

export function getLeadTargetMetaEvent(lead: Lead): {
  eventName: MetaCapiEventName
  signalLabel: string
  stageLabel: string
  effectiveStage: LeadStage
} {
  const effectiveStage: LeadStage =
    lead.stage === 'NEW' && lead.isQualified ? 'QUALIFIED' : lead.stage
  return {
    ...mapStageOrSignalToMetaEvent(effectiveStage),
    effectiveStage,
  }
}

export function isLeadPendingMetaSync(lead: Lead): boolean {
  const target = getLeadTargetMetaEvent(lead)
  if (!stageEvent[lead.stage]) return false
  if (lead.metaRevision === undefined || !(lead.metaLeadId || lead.inquiries?.some(i => i.metaLeadgenId))) return false
  if (!lead.metaCapiStatus) return true
  if (lead.metaCapiStatus.revision !== lead.metaRevision) return true
  if (lead.metaCapiStatus.status !== 'SENT') return true
  if (lead.metaCapiStatus.lastEventName !== target.eventName) return true
  if (lead.metaCapiStatus.label !== target.signalLabel) return true
  return false
}

class MetaStore {
  private stageWrites = new MetaStageQueue()
  public resetStageWrite(id: string) { this.stageWrites.reconcile(id) }
  public persistStageChange(lead: Lead) {
    // Eski yerel kayıtlar otoriter sunucu sürümü olmadan buluta yazılmaz.
    if (lead.metaRevision === undefined) return
    const write = this.stageWrites.enqueue(lead.id, async () => {
      const current = leadStore.getById(lead.id)
      const result = await invokeMeta({ action: 'stage', leadId: lead.id, revision: current?.metaRevision ?? lead.metaRevision,
        stage: lead.stage, qualified: lead.stage === 'QUALIFIED' ? true : ['LOST','NO_INTENT'].includes(lead.stage) ? false : !!lead.isQualified })
      leadStore.ackMetaStage(lead.id, result.revision, result.updatedAt, lead.stage)
    })
    void write.catch(error => {
      leadStore.updateMetaCapiStatus(lead.id, { lastEventName: 'StagePersistence', label: 'Sunucu aşaması kaydedilemedi',
        status: 'FAILED', sentAt: new Date().toISOString(), errorMessage: (error as Error).message })
    })
  }
  private config = { ...DEFAULT_META_CONFIG }
  private capiLogs: MetaCapiEventLog[] = []
  private listeners = new Set<() => void>()
  constructor() {
    // Eski tarayıcı sırlarını tekrar kullanmayın / buluta geri kopyalamayın.
    try { localStorage.removeItem('demirturk_meta_api_config'); localStorage.removeItem('demirturk_meta_capi_logs_v1') } catch { /* storage unavailable */ }
  }
  private notify() { this.listeners.forEach(fn => fn()) }
  public subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  public getConfig() { return { ...this.config } }
  public getCapiLogs() { return [...this.capiLogs] }
  public clearCapiLogs() { this.capiLogs = []; this.notify() } // Sunucu denetim geçmişini silmez.
  public saveConfig(_config: Partial<MetaApiConfig>) { throw new Error('Meta ayarları ve sırları yalnızca sunucuda yönetilir; tarayıcıya kaydedilmedi.') }
  public async refreshStatus() {
    const data = await invokeMeta({ action: 'status' })
    this.config = { ...DEFAULT_META_CONFIG, datasetId: data.datasetId || '', autoSyncStages: !!data.autoSyncStages,
      isConnected: false, lastCheckedAt: new Date().toISOString() }
    this.capiLogs = (data.events || []).map((e: Record<string, any>) => this.toLog(e))
    const seen = new Set<string>()
    for (const e of data.events || []) {
      if (e.test_mode || seen.has(e.lead_id)) continue
      seen.add(e.lead_id)
      const log = this.toLog(e)
      const mapped = mapStageOrSignalToMetaEvent(e.event_name)
      leadStore.updateMetaCapiStatus(e.lead_id, { lastEventName: log.eventName, label: mapped.signalLabel,
        revision: e.revision, metaLeadgenId: e.meta_leadgen_id, sentAt: log.sentAt, status: log.status, fbtraceId: log.fbtraceId, errorMessage: log.errorMessage })
    }
    this.notify()
    return data
  }
  public async setAutoSyncStages(enabled: boolean) {
    if (enabled) throw new Error('Demo sürümünde otomatik Meta geri bildirimi kilitli. Müşteriyi seçerek elle gönderin.')
    await invokeMeta({ action: 'configure', autoSyncStages: enabled })
    await this.refreshStatus()
  }
  public async testConnection(_token?: string) {
    try { const data = await invokeMeta({ action: 'connection' }); return { success: true, pageName: data.message } }
    catch (error) { return { success: false, error: (error as Error).message } }
  }
  private toLog(e: Record<string, any>): MetaCapiEventLog {
    return { id: e.id, leadId: e.lead_id, leadName: '', phone: '', eventName: e.event_name,
      metaLeadId: e.meta_leadgen_id,
      signalLabel: e.event_name, stage: '', sentAt: e.sent_at || e.last_attempt_at || '',
      status: e.state === 'sent' ? 'SENT' : e.state === 'rejected' ? 'FAILED' : 'QUEUED',
      eventsReceived: e.events_received, fbtraceId: e.fbtrace_id, errorMessage: e.error_code,
      payloadPreview: { state: e.state, attempt: e.attempt, testMode: e.test_mode, revision: e.revision } }
  }
  public async sendCapiLeadEvent(lead: Lead, stageOrSignal: LeadStage | MetaCapiEventName, options?: { note?: string; value?: number; metaLeadgenId?: string }): Promise<MetaCapiEventLog> {
    const mapped = mapStageOrSignalToMetaEvent(stageOrSignal)
    let log: MetaCapiEventLog
    try {
      await this.stageWrites.wait(lead.id)
      if (!stageEvent[lead.stage] || mapped.eventName !== stageEvent[lead.stage]) throw new Error('Bu CRM aşaması doğrulanmış bir Meta dönüşümü değildir; teklif ve satış bedeli uydurulmaz.')
      const current = leadStore.getById(lead.id)
      if (!current || current.stage !== lead.stage || current.metaRevision === undefined) throw new Error('Sunucu aşaması yeniden okunmalı; eski veya doğrulanmamış kayıt gönderilmedi.')
      const data = await invokeMeta({ action: 'enqueue', leadId: lead.id, revision: current.metaRevision, eventName: mapped.eventName,
        leadgenId: options?.metaLeadgenId, retry: !!lead.metaCapiStatus })
      log = this.toLog(data.event)
    } catch (error) {
      // Yerel hata sunucuda kuyruğa alınmış gibi gösterilmez.
      log = { id: crypto.randomUUID(), leadId: lead.id, leadName: '', phone: '', eventName: mapped.eventName,
        signalLabel: mapped.signalLabel, stage: lead.stage, sentAt: new Date().toISOString(), status: 'FAILED',
        errorMessage: (error as Error).message, payloadPreview: { persisted: false } }
    }
    this.capiLogs = [log, ...this.capiLogs.filter(x => x.id !== log.id)].slice(0,100)
    leadStore.updateMetaCapiStatus(lead.id, { lastEventName: log.eventName, label: mapped.signalLabel,
      revision: typeof log.payloadPreview.revision === 'number' ? log.payloadPreview.revision : undefined,
      metaLeadgenId: log.metaLeadId,
      sentAt: log.sentAt, status: log.status, fbtraceId: log.fbtraceId, errorMessage: log.errorMessage })
    this.notify()
    return log
  }
  public getPendingMetaSyncLeads() { return leadStore.getAllRaw().filter(isLeadPendingMetaSync) }
  public async flushQueuedCapiEvents() {
    // Eski yerel payload'lar yeniden oynatılmaz. Yetkili worker kalıcı kuyruğu işler.
    await this.refreshStatus()
    return { sentCount: 0, failedCount: 0 }
  }
  public async syncLeadsToMetaManual(leadIds?: string[], sourceSelections: Record<string,string> = {}) {
    if (!leadIds?.length) throw new Error('Geçmiş toplu aktarım kapalıdır. Önce gönderilecek müşterileri açıkça seçin.')
    if (leadIds.length > 30) throw new Error('Tek işlemde en fazla 30 müşteri seçilebilir.')
    const ids = new Set(leadIds)
    const targets = this.getPendingMetaSyncLeads().filter(l => ids.has(l.id))
    const result = { sentCount: 0, failedCount: 0, queuedCount: 0, totalCount: targets.length }
    for (const lead of targets) {
      const log = await this.sendCapiLeadEvent(lead, lead.stage, { metaLeadgenId: sourceSelections[lead.id] })
      if (log.status === 'SENT') result.sentCount++
      else if (log.status === 'QUEUED') result.queuedCount++
      else result.failedCount++
    }
    return result
  }
  public async sendTestCapiEvent(_config?: { datasetId?: string; capiAccessToken?: string; testEventCode?: string }, leadId?: string, metaLeadgenId?: string) {
    if (!leadId) return { success: false, message: 'Test için gerçek Meta kimlikli ve uygun aşamadaki müşteri açıkça seçilmelidir. Test olay kodu yalnızca sunucuda ayarlanır.' }
    try {
      await this.stageWrites.wait(leadId)
      const lead = leadStore.getById(leadId)
      if (!lead || lead.metaRevision === undefined || !stageEvent[lead.stage]) throw new Error('Test için güncel sunucu aşaması gerekli.')
      const data = await invokeMeta({ action: 'test', leadId, revision: lead.metaRevision, eventName: stageEvent[lead.stage], leadgenId: metaLeadgenId, retry: true })
      return { success: data.event.state === 'sent', message: data.event.state === 'sent' ? 'Meta API test olayını kabul etti; eşleşme ve atıf ayrıca doğrulanmalıdır.' : 'Test olayı kabul edilmedi; olay geçmişini inceleyin.' }
    } catch (error) { return { success: false, message: (error as Error).message } }
  }
  public getForms(): MetaFormSummary[] {
    const groups = new Map<string, Lead[]>()
    for (const lead of leadStore.getAllRaw()) {
      const names = new Set((lead.inquiries || []).filter(i => i.source === 'META_ADS').map(i => i.formName))
      if (!names.size && lead.source === 'META_ADS') names.add(lead.formName)
      for (const name of names) groups.set(name, [...(groups.get(name) || []), lead])
    }
    return [...groups].map(([name, leads]) => {
      const campaigns = [...new Set(leads.flatMap(l=>(l.inquiries||[]).filter(i=>i.formName===name).map(i=>i.campaignName)).filter(Boolean))]
      return { id: name, name, campaignName: campaigns.length===1 ? campaigns[0]! : campaigns.length>1 ? 'Birden fazla kampanya' : 'Kampanya atfı bilinmiyor',
        leadCount: leads.length, conversionRate: Math.round(leads.filter(l => l.isQualified).length / leads.length * 100),
        status: 'UNKNOWN' as const, lastLeadAt: leads.map(l => l.createdAt).sort().at(-1) || '' }
    })
  }
  public getWebhookLogs(): MetaWebhookEvent[] { return [] }
  public simulateIncomingLead(_data: { fullName: string; phone: string; email?: string; formName: string; campaignName?: string; budget?: number; preferredHousingType?: string; investmentPurpose?: string; moveInTiming?: string; metaAnswers?: { question: string; answer: string }[] }) {
    // Simülasyon gerçek müşteri / leadgen kimliği veya canlı dönüşüm oluşturmaz.
    return undefined
  }
  public async fetchLeadsFromMeta(startDate: Date, endDate: Date): Promise<{ newCount: number; mergedCount: number; needsPageToken?: boolean; error?: string }> {
    let newCount = 0, mergedCount = 0
    const seen = new Set<string>()
    try {
      const range = { from: startDate.toISOString(), to: endDate.toISOString() }
      let formCursor: string | null = null
      const formCursors = new Set<string>()
      do {
        const data = await invokeMeta({ action: 'pull', ...range, cursor: formCursor })
        for (const form of data.forms || []) {
          let cursor: string | null = null
          const leadCursors = new Set<string>()
          do {
            const page = await invokeMeta({ action: 'pull', ...range, formId: form.id, cursor })
            for (const row of page.leads || []) {
              const lead = rowToLead(row)
              const existing = leadStore.getById(lead.id)
              if (!seen.has(row.id)) { if (existing) mergedCount++; else newCount++; seen.add(row.id) }
              leadStore.acceptMetaServerLead(lead)
            }
            const next = page.cursor || null
            if (next && leadCursors.has(next)) throw new Error('Meta müşteri sayfalaması döngüye girdi; aktarım kısmi olabilir.')
            if (next) leadCursors.add(next)
            cursor = next
          } while (cursor)
        }
        const nextForm = data.cursor || null
        if (nextForm && formCursors.has(nextForm)) throw new Error('Meta form sayfalaması döngüye girdi; aktarım kısmi olabilir.')
        if (nextForm) formCursors.add(nextForm)
        formCursor = nextForm
      } while (formCursor)
      return { newCount, mergedCount }
    } catch (error) { return { newCount, mergedCount, error: (error as Error).message } }
  }

  public importLeadsFromMetaCsvText(
    rawText: string,
    startDate?: Date,
    endDate?: Date
  ): { newCount: number; mergedCount: number } {
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

      let leadId = ''
      let createdTime = ''
      let formName = 'Meta Ads Formu'
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

        if (hl === 'id' || hl === 'lead_id') {
          leadId = val.replace(/^l:/i, '').trim()
        } else if (hl.includes('created_time') || hl.includes('tarih') || hl.includes('oluşturul') || hl.includes('olusturul')) {
          createdTime = val
        } else if (hl.includes('form_name') || hl === 'form') {
          formName = val
        } else if (hl.includes('campaign_name') || hl.includes('ad_name') || hl.includes('kampanya')) {
          campaignName = campaignName || val
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
        } else if (
          !['ad_id', 'adset_id', 'adset_name', 'campaign_id', 'form_id', 'is_organic', 'platform', 'lead_status', 'kaynak', 'kanal', 'aşama', 'asama', 'sahibi'].includes(hl)
        ) {
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

      if (startDate && validDate.getTime() < startDate.getTime()) continue
      if (endDate && validDate.getTime() > endDate.getTime()) continue

      const res = leadStore.addOrMergeInquiry({
        fullName: fullName || 'Meta Müşterisi',
        phone: phone || '',
        whatsappPhone: phone || '',
        email: email || undefined,
        source: 'META_ADS',
        formName,
        campaignName: campaignName || undefined,
        channel: 'Meta Lead Ads',
        metaLeadgenId: leadId || undefined,
        preferredHousingType: preferredHousingType || undefined,
        metaAnswers: metaAnswers.length > 0 ? metaAnswers : undefined,
        createdAt: validDate.toISOString(),
      }, { skipSave: true })

      if (res.isNewCustomer) {
        newCount++
      } else {
        mergedCount++
      }
    }

    if (newCount > 0 || mergedCount > 0) {
      leadStore.flushSave()
    }
    return { newCount, mergedCount }
  }
}
export const metaStore = new MetaStore()

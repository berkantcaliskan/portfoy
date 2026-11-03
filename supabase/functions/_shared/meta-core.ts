export class MetaError extends Error {
  status: number
  graphCode?: number
  constructor(status: number, message: string, graphCode?: number) { super(message); this.status = status; this.graphCode = graphCode }
}
export async function readBody(req: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(req.headers.get('content-length') || 0) > limit) throw new MetaError(413, 'İstek çok büyük.')
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new MetaError(413, 'İstek çok büyük.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return body
}

export function deliveryMode(settings: { enabled: boolean; security_ready: boolean }, action: string) {
  if (action === 'process') throw new MetaError(409, 'Demo sürümünde arka plan gönderimi kapalı. Olayı seçerek elle yeniden deneyin.')
  if (!settings.security_ready || (!settings.enabled && action !== 'test' && action !== 'process')) {
    throw new MetaError(409, 'Yönetici güvenli geçişi tamamlamadan Meta gönderimi kapalıdır.')
  }
  return { testOnly: !settings.enabled }
}
export function normalizePhone(value?: string | null): string {
  let n = String(value || '').replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (/^05\d{9}$/.test(n)) n = `90${n.slice(1)}`
  if (/^5\d{9}$/.test(n)) n = `90${n}`
  return /^905\d{9}$/.test(n) ? n : ''
}
export async function verifySignature(body: Uint8Array, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, x => parseInt(x, 16))
  return crypto.subtle.verify('HMAC', key, bytes, new Uint8Array(body))
}
export async function hash(value: string): Promise<string> {
  return hashRaw(value.trim().toLowerCase())
}
async function hashRaw(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
export function graphVersion(version?: string): string {
  if (!version || !/^v\d+\.0$/.test(version)) throw new MetaError(503, 'META_GRAPH_VERSION yönetici tarafından doğrulanmalıdır.')
  return version
}
export async function graphGet(path: string, token: string, version: string, fetcher: typeof fetch = fetch) {
  if (!token) throw new MetaError(503, 'Meta sayfa anahtarı yapılandırılmamış.')
  let response: Response
  try { response = await fetcher(`https://graph.facebook.com/${graphVersion(version)}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000),
  }) } catch { throw new MetaError(503, 'Meta erişim zaman aşımı; tekrar denenebilir.') }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || data.error) throw new MetaError(503, 'Meta verisi alınamadı; yetki ve API sürümü kontrol edilmeli.', data?.error?.code)
  return data
}
export const META_LEAD_FIELDS = 'id,created_time,form_id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,is_organic,platform,field_data'
export function metaId(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d{1,32}$/.test(value)) return value
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return undefined
}
export async function graphLeadGet(path: string, token: string, version: string, fetcher?: typeof fetch) {
  const url = (fields: string) => `${path}${path.includes('?') ? '&' : '?'}fields=${fields}`
  try { return await graphGet(url(META_LEAD_FIELDS), token, version, fetcher) }
  catch (error) {
    // Reklam atfı yetkisi eksikse müşteri/form yanıtlarını da kaybetmeyin; kısmi atfı açıkça kaydedin.
    if (!(error instanceof MetaError) || ![10,100,200,294].includes(error.graphCode || 0)) throw error
    const result = await graphGet(url('id,created_time,form_id,field_data'), token, version, fetcher)
    const mark = (lead: Record<string, any>) => ({ ...lead, __metaWarnings: ['ATTRIBUTION_RESTRICTED'] })
    return Array.isArray(result.data) ? { ...result, data: result.data.map(mark) } : mark(result)
  }
}
export interface Intake {
  leadgenId: string; formId?: string; adId?: string; campaignId?: string; campaignName?: string
  pageId?: string; adName?: string; adsetId?: string; adsetName?: string; platform?: string; isOrganic?: boolean
  firstName?: string; lastName?: string; city?: string; state?: string; zip?: string; country?: string; warnings?: string[]
  formName: string; fullName: string; phone: string; email?: string; createdAt: string
  housingType?: string; budget?: number; answers: { question: string; answer: string }[]
  fields: { name: string; values: string[] }[]
}
export function normalizeLead(details: Record<string, any>, value: Record<string, any>, formName?: string): Intake {
  const leadgenId = metaId(value.leadgen_id)
  if (!leadgenId) throw new MetaError(400, 'Meta başvuru kimliği geçersiz veya hassasiyet kaybetmiş.')
  const fields = Array.isArray(details.field_data) ? details.field_data : []
  if (!fields.every(f => f && typeof f.name === 'string' && Array.isArray(f.values) && f.values.every((v: unknown) => typeof v === 'string'))) throw new MetaError(502, 'Meta form alanları geçersiz.')
  const key = (name: string) => name.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
  const get = (...keys: string[]) => fields.find(f => keys.map(key).includes(key(f.name)))?.values.join(', ').trim() || ''
  const phone = get('phone_number','telefon','phone','telefon_numarasi','telefon_numaraniz','cep_telefonu','mobile_phone')
  const created = details.created_time || (value.created_time ? new Date(value.created_time * 1000).toISOString() : '')
  if (!created || !Number.isFinite(Date.parse(created))) throw new MetaError(502, 'Meta başvuru zamanı eksik.')
  const name = get('full_name', 'ad_soyad', 'adi_soyadi', 'adiniz_soyadiniz', 'isim', 'name') || `${get('first_name')} ${get('last_name')}`.trim()
  const rawBudget = get('budget', 'butce')
  return {
    leadgenId, formId: metaId(details.form_id || value.form_id),
    adId: metaId(details.ad_id || value.ad_id), campaignId: metaId(details.campaign_id),
    pageId: metaId(value.page_id), adName: details.ad_name || undefined,
    adsetId: metaId(details.adset_id), adsetName: details.adset_name || undefined,
    platform: details.platform || undefined, isOrganic: typeof details.is_organic === 'boolean' ? details.is_organic : undefined,
    firstName: get('first_name') || undefined, lastName: get('last_name') || undefined,
    city: get('city','sehir','şehir') || undefined, state: get('state') || undefined,
    zip: get('post_code','zip_code','zip') || undefined, country: get('country') || undefined,
    warnings: [...(Array.isArray(details.__metaWarnings) ? details.__metaWarnings : []), ...(fields.length ? [] : ['FORM_FIELDS_UNAVAILABLE']),
      ...(phone && !normalizePhone(phone) ? ['PHONE_UNSUPPORTED_OR_INVALID'] : [])],
    campaignName: details.campaign_name || undefined, formName: formName || 'Bilinmeyen Meta formu',
    fullName: name || 'İsmi belirtilmemiş başvuru', phone: normalizePhone(phone),
    email: get('email','email_address','e-posta','eposta','e_posta_adresi') || undefined, createdAt: new Date(created).toISOString(),
    housingType: fields.find(f => /konut|housing|daire/i.test(f.name))?.values.join(', '),
    budget: /^\d+(\.\d{1,2})?$/.test(rawBudget) ? Number(rawBudget) : undefined,
    answers: fields.map(f => ({ question: f.name, answer: f.values.join(', ') })), fields,
  }
}
export interface WebhookDependencies {
  verifyToken: string; appSecret: string; pageToken: string; version: string; pageId: string
  fetcher?: typeof fetch; ingest: (intake: Intake) => Promise<void>
}
export function createWebhook(deps: WebhookDependencies) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method === 'GET') {
        const q = new URL(req.url).searchParams
        if (!deps.verifyToken) throw new MetaError(503, 'Webhook yapılandırılmamış.')
        if (q.get('hub.mode') !== 'subscribe' || q.get('hub.verify_token') !== deps.verifyToken || !q.has('hub.challenge')) throw new MetaError(403, 'Doğrulama reddedildi.')
        return new Response(q.get('hub.challenge'), { headers: { 'Content-Type': 'text/plain' } })
      }
      if (req.method !== 'POST') return new Response('Yöntem desteklenmiyor.', { status: 405 })
      if (!deps.appSecret || !deps.pageToken || !deps.pageId) throw new MetaError(503, 'Webhook sunucu ayarları eksik.')
      const raw = await readBody(req, 1048576)
      if (!await verifySignature(raw, req.headers.get('x-hub-signature-256'), deps.appSecret)) throw new MetaError(401, 'İmza doğrulanamadı.')
      let payload: any
      try { payload = JSON.parse(new TextDecoder().decode(raw)) } catch { throw new MetaError(400, 'Geçersiz JSON.') }
      if (!payload || payload.object !== 'page' || !Array.isArray(payload.entry)) throw new MetaError(400, 'Geçersiz webhook nesnesi.')
      for (const entry of payload.entry) {
        if (!entry || String(entry.id) !== deps.pageId) throw new MetaError(403, 'Yetkisiz sayfa.')
        if (!Array.isArray(entry.changes)) throw new MetaError(400, 'Değişiklik listesi eksik.')
        for (const change of entry.changes) {
          if (!change || change.field !== 'leadgen') continue
          const value = change.value || {}
          const leadgenId = metaId(value.leadgen_id)
          if (!leadgenId) throw new MetaError(400, 'Meta lead kimliği eksik veya geçersiz.')
          const details = await graphLeadGet(leadgenId, deps.pageToken, deps.version, deps.fetcher)
          if (metaId(details.id) !== leadgenId) throw new MetaError(502, 'Meta lead kimliği uyuşmuyor.')
          const formId = String(details.form_id || value.form_id || '')
          let formName: string | undefined
          if (/^\d{1,32}$/.test(formId)) {
            try { formName = (await graphGet(`${formId}?fields=name`, deps.pageToken, deps.version, deps.fetcher)).name }
            catch { details.__metaWarnings = [...(details.__metaWarnings || []), 'FORM_NAME_UNAVAILABLE'] }
          }
          await deps.ingest(normalizeLead(details, { ...value, page_id: deps.pageId }, formName))
        }
      }
      return new Response('EVENT_RECEIVED')
    } catch (error) {
      return new Response(error instanceof MetaError ? error.message : 'Kalıcı kayıt tamamlanamadı; tekrar denenmeli.', { status: error instanceof MetaError ? error.status : 503 })
    }
  }
}
export const stageEvent: Record<string, string | null> = {
  NEW: null, CONTACTED: 'Contact', UNDECIDED: null, QUALIFIED: 'QualifiedLead',
  NO_INTENT: 'DisqualifiedLead', LOST: 'DisqualifiedLead', APPOINTMENT: 'Schedule',
  PRESENTATION: null, OFFER: null, WON: null,
}
export function originalLeadId(lead: Record<string, any>): string | undefined {
  // Bu alan yalnızca sunucunun meta_lead_events tablosundan oluşturduğu snapshot'tan gelir.
  return typeof lead.meta_lead_id === 'string' && /^\d{1,32}$/.test(lead.meta_lead_id) ? lead.meta_lead_id : undefined
}
export async function buildCapiEvent(row: Record<string, any>) {
  const lead = row.snapshot
  if (typeof lead.id !== 'string' || !lead.id) throw new MetaError(422, 'CRM müşteri kimliği eksik.')
  const eventName = stageEvent[lead.stage]
  if (!eventName || eventName !== row.event_name) throw new MetaError(422, 'Bu aşama doğrulanmış bir Meta dönüşümü değildir.')
  if (eventName === 'QualifiedLead' && !lead.is_qualified) throw new MetaError(422, 'Nitelik kararı doğrulanmamış.')
  const leadId = originalLeadId(lead)
  if (!leadId) throw new MetaError(422, 'Orijinal Meta lead kimliği yok; kimlik üretilmedi.')
  const user: Record<string, unknown> = { lead_id: leadId, external_id: [await hashRaw(lead.id)] }
  const source = lead.meta_source || {}
  const phones = [...new Set([lead.phone, source.phone].map(normalizePhone).filter(Boolean))]
  if (phones.length) user.ph = await Promise.all(phones.map(hash))
  const emails = [...new Set([lead.email, source.email].map(x => String(x || '').trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))]
  if (emails.length) user.em = await Promise.all(emails.map(hash))
  const fullName = String(source.fullName || lead.full_name || '').trim()
  const names = fullName.split(/\s+/)
  if (!fullName.includes('belirtilmemiş')) {
    if (source.firstName || names[0]) user.fn = [await hash(source.firstName || names[0])]
    if (source.lastName || names.length > 1) user.ln = [await hash(source.lastName || names.slice(1).join(' '))]
  }
  if (/^\d{1,32}$/.test(source.pageId || '')) user.page_id = source.pageId
  for (const [key, raw] of [['ct',source.city],['st',source.state],['zp',source.zip],['country',source.country]]) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    let value = raw.trim().toLowerCase()
    if (key === 'ct' || key === 'st') value = value.replace(/[0-9.\s\-()]/g, '')
    if (key === 'zp') value = value.replace(/\s/g, '').split('-')[0]
    if (key === 'country') {
      if (['türkiye','turkiye','turkey'].includes(value)) value = 'tr'
      if (!/^[a-z]{2}$/.test(value)) continue
    }
    if (value) user[key] = [await hash(value)]
  }
  const eventTime = Math.floor(Date.parse(row.occurred_at) / 1000)
  if (!Number.isFinite(eventTime)) throw new MetaError(422, 'Olay zamanı geçersiz.')
  const custom: Record<string, string> = { event_source: 'crm', lead_event_source: 'Demirtürk Portföy CRM', crm_stage: lead.stage, lead_status: eventName }
  for (const [key, value] of [['form_id',source.formId],['ad_id',source.adId],['adset_id',source.adsetId],['campaign_id',source.campaignId]]) {
    if (typeof value === 'string' && /^\d{1,32}$/.test(value)) custom[key] = value
  }
  return { event_name: eventName, event_id: row.id, event_time: eventTime, action_source: 'system_generated', user_data: user, custom_data: custom }
}
export function deliveryResult(httpStatus: number, body: any, attempt: number) {
  if (httpStatus >= 200 && httpStatus < 300 && !body?.error && body?.events_received === 1) return { state: 'sent', received: 1, trace: typeof body.fbtrace_id === 'string' ? body.fbtrace_id : null, retrySeconds: null }
  const transient = httpStatus === 0 || httpStatus === 429 || httpStatus >= 500 || body?.error?.is_transient === true || [1, 2, 4, 17, 32, 613].includes(body?.error?.code)
  return { state: transient && attempt < 5 ? 'retry' : 'rejected', received: Number(body?.events_received) || 0,
    trace: typeof body?.error?.fbtrace_id === 'string' ? body.error.fbtrace_id : null,
    retrySeconds: transient && attempt < 5 ? Math.min(3600, 30 * 2 ** (attempt - 1)) : null }
}

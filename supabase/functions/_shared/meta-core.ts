export class MetaError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
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
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toLowerCase()))
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
  if (!response.ok || !data || data.error) throw new MetaError(503, 'Meta verisi alınamadı; yetki ve API sürümü kontrol edilmeli.')
  return data
}
export interface Intake {
  leadgenId: string; formId?: string; adId?: string; campaignId?: string; campaignName?: string
  formName: string; fullName: string; phone: string; email?: string; createdAt: string
  housingType?: string; budget?: number; answers: { question: string; answer: string }[]
  fields: { name: string; values: string[] }[]
}
export function normalizeLead(details: Record<string, any>, value: Record<string, any>, formName?: string): Intake {
  const fields = Array.isArray(details.field_data) ? details.field_data : []
  if (!fields.every(f => f && typeof f.name === 'string' && Array.isArray(f.values) && f.values.every((v: unknown) => typeof v === 'string'))) throw new MetaError(502, 'Meta form alanları geçersiz.')
  const get = (...keys: string[]) => fields.find(f => keys.includes(f.name.toLowerCase()))?.values.join(', ').trim() || ''
  const created = details.created_time || (value.created_time ? new Date(value.created_time * 1000).toISOString() : '')
  if (!created || !Number.isFinite(Date.parse(created))) throw new MetaError(502, 'Meta başvuru zamanı eksik.')
  const name = get('full_name', 'ad_soyad', 'adi_soyadi', 'adiniz_soyadiniz', 'isim', 'name') || `${get('first_name')} ${get('last_name')}`.trim()
  const rawBudget = get('budget', 'butce')
  return {
    leadgenId: String(value.leadgen_id), formId: String(details.form_id || value.form_id || '') || undefined,
    adId: String(details.ad_id || value.ad_id || '') || undefined, campaignId: details.campaign_id || undefined,
    campaignName: details.campaign_name || undefined, formName: formName || 'Bilinmeyen Meta formu',
    fullName: name || 'İsmi belirtilmemiş başvuru', phone: normalizePhone(get('phone_number', 'telefon', 'phone')),
    email: get('email', 'e-posta') || undefined, createdAt: new Date(created).toISOString(),
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
          if (!/^\d{1,32}$/.test(String(value.leadgen_id || ''))) throw new MetaError(400, 'Meta lead kimliği eksik veya geçersiz.')
          const details = await graphGet(`${value.leadgen_id}?fields=id,created_time,form_id,ad_id,campaign_id,campaign_name,field_data`, deps.pageToken, deps.version, deps.fetcher)
          if (String(details.id) !== String(value.leadgen_id)) throw new MetaError(502, 'Meta lead kimliği uyuşmuyor.')
          const formId = String(details.form_id || value.form_id || '')
          let formName: string | undefined
          if (/^\d{1,32}$/.test(formId)) {
            try { formName = (await graphGet(`${formId}?fields=name`, deps.pageToken, deps.version, deps.fetcher)).name } catch { /* unknown */ }
          }
          await deps.ingest(normalizeLead(details, value, formName))
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
  const eventName = stageEvent[lead.stage]
  if (!eventName || eventName !== row.event_name) throw new MetaError(422, 'Bu aşama doğrulanmış bir Meta dönüşümü değildir.')
  if (eventName === 'QualifiedLead' && !lead.is_qualified) throw new MetaError(422, 'Nitelik kararı doğrulanmamış.')
  const leadId = originalLeadId(lead)
  if (!leadId) throw new MetaError(422, 'Orijinal Meta lead kimliği yok; kimlik üretilmedi.')
  const user: Record<string, unknown> = { lead_id: leadId, external_id: [await hash(lead.id)] }
  const phone = normalizePhone(lead.phone)
  if (phone) user.ph = [await hash(phone)]
  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) user.em = [await hash(lead.email)]
  const names = String(lead.full_name || '').trim().split(/\s+/)
  if (names[0] && !String(lead.full_name).includes('belirtilmemiş')) user.fn = [await hash(names[0])]
  if (names.length > 1) user.ln = [await hash(names.slice(1).join(' '))]
  const eventTime = Math.floor(Date.parse(row.occurred_at) / 1000)
  if (!Number.isFinite(eventTime)) throw new MetaError(422, 'Olay zamanı geçersiz.')
  return { event_name: eventName, event_id: row.id, event_time: eventTime, action_source: 'system_generated', user_data: user,
    custom_data: { event_source: 'crm', lead_event_source: 'Demirtürk Portföy CRM' } }
}
export function deliveryResult(httpStatus: number, body: any, attempt: number) {
  if (httpStatus >= 200 && httpStatus < 300 && !body?.error && body?.events_received === 1) return { state: 'sent', received: 1, trace: typeof body.fbtrace_id === 'string' ? body.fbtrace_id : null, retrySeconds: null }
  const transient = httpStatus === 0 || httpStatus === 429 || httpStatus >= 500 || body?.error?.is_transient === true || [1, 2, 4, 17, 32, 613].includes(body?.error?.code)
  return { state: transient && attempt < 5 ? 'retry' : 'rejected', received: Number(body?.events_received) || 0,
    trace: typeof body?.error?.fbtrace_id === 'string' ? body.error.fbtrace_id : null,
    retrySeconds: transient && attempt < 5 ? Math.min(3600, 30 * 2 ** (attempt - 1)) : null }
}

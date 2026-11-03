import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'
import { buildCapiEvent, deliveryResult, graphGet, graphLeadGet, graphVersion, MetaError, normalizeLead, readBody, deliveryMode } from './meta-core.ts'

const json = (body: unknown, status = 200, origin = '') => Response.json(body, {
  status, headers: { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
})

export function createCapiHandler(deps: {
  env: (name: string) => string
  createClient: (url: string, key: string, options: { auth: { persistSession: boolean } }) => SupabaseClient
  fetcher?: typeof fetch
}) {
const { env, createClient } = deps
const fetcher = deps.fetcher || fetch
return async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') || ''
  const allowed = env('META_ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean)
  if (origin && !allowed.includes(origin)) return json({ error: 'Bu kaynağa izin verilmiyor.' }, 403)
  if (req.method === 'OPTIONS') return json({}, 200, origin)
  if (req.method !== 'POST') return json({ error: 'Yöntem desteklenmiyor.' }, 405, origin)
  try {
    if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new MetaError(503, 'Sunucu ayarları eksik.')
    const text = new TextDecoder().decode(await readBody(req, 8192))
    let input: any
    try { input = JSON.parse(text) } catch { throw new MetaError(400, 'Geçersiz JSON.') }
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.action !== 'string') throw new MetaError(400, 'Geçersiz işlem isteği.')
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const worker = input.action === 'process' && !!env('META_WORKER_SECRET') &&
      // Timing-safe digest comparison through Web Crypto HMAC verification.
      await (async () => {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('META_WORKER_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify'])
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
        return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(env('META_WORKER_SECRET')))
      })()
    let member: any = null
    let userId: string | undefined
    if (!worker) {
      if (!token) throw new MetaError(401, 'Supabase Auth oturumu gerekli; yerel CRM girişi yeterli değildir.')
      const { data, error } = await db.auth.getUser(token)
      if (error || !data.user) throw new MetaError(401, 'Oturum doğrulanamadı.')
      userId = data.user.id
      const result = await db.from('meta_members').select('can_send,is_admin').eq('auth_user_id', userId).maybeSingle()
      if (result.error || !result.data || !(result.data.can_send || result.data.is_admin)) throw new MetaError(403, 'Meta gönderim yetkisi yok.')
      member = result.data
    }
    const { data: settings, error: settingsError } = await db.from('meta_settings').select('*').eq('id', true).single()
    if (settingsError) throw new MetaError(503, 'Meta migration veya ayarları eksik.')
    if (input.action === 'status' || input.action === 'history') {
      let query = db.from('meta_outbox').select('id,lead_id,meta_leadgen_id,revision,event_name,state,attempt,next_attempt_at,last_attempt_at,sent_at,events_received,fbtrace_id,error_code,test_mode').order('occurred_at', { ascending: false }).limit(100)
      if (!member?.is_admin) query = query.eq('requested_by', userId)
      const { data: events, error } = await query
      if (error) throw new MetaError(503, 'Olay geçmişi okunamadı.')
      return json({ configured: !!(env('META_DATASET_ID') && env('META_CAPI_ACCESS_TOKEN') && env('META_GRAPH_VERSION')),
        enabled: settings.enabled, testOnly: env('META_TEST_ONLY') === 'true', autoSyncStages: false, manualOnly: true, backgroundDelivery: false, securityReady: settings.security_ready,
        datasetId: env('META_DATASET_ID'), events }, 200, origin)
    }
    if (input.action === 'stage') {
      if (typeof input.leadId !== 'string' || typeof input.stage !== 'string' || typeof input.qualified !== 'boolean'
        || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new MetaError(400, 'Aşama isteği geçersiz; sunucu sürümü gerekli.')
      const { data: lead, error } = await db.rpc('meta_set_stage', { p_user: userId, p_lead: input.leadId,
        p_revision: input.revision, p_stage: input.stage, p_qualified: input.qualified })
      if (error) throw new MetaError(409, 'Aşama sunucuya kaydedilemedi; yetki veya sürüm çakışmasını kontrol edip kaydı yeniden okuyun.')
      return json({ revision: lead.meta_revision, updatedAt: lead.updated_at }, 200, origin)
    }
    if (input.action === 'sources') {
      if (typeof input.leadId !== 'string' || input.leadId.length > 200) throw new MetaError(400, 'Müşteri kimliği geçersiz.')
      const { data, error } = await db.rpc('meta_list_sources', { p_user: userId, p_lead: input.leadId })
      if (error) throw new MetaError(403, 'Bu müşterinin Meta başvuruları okunamadı.')
      return json({ sources: (data || []).map((e: any) => ({ leadgenId: e.leadgen_id, submittedAt: e.submitted_at, ...e.context })) }, 200, origin)
    }
    const dataset = env('META_DATASET_ID'), accessToken = env('META_CAPI_ACCESS_TOKEN')
    if (input.action === 'configure') {
      if (!member?.is_admin || typeof input.autoSyncStages !== 'boolean') throw new MetaError(403, 'Yönetici yetkisi gerekli.')
      if (input.autoSyncStages) throw new MetaError(409, 'Demo sürümünde otomatik Meta geri bildirimi kilitli; elle gönderim kullanın.')
      const { error } = await db.from('meta_settings').update({ auto_sync: input.autoSyncStages }).eq('id', true)
      if (error) throw new MetaError(503, 'Ayar kaydedilemedi.')
      return json({ success: true }, 200, origin)
    }
    const version = graphVersion(env('META_GRAPH_VERSION'))
    if (input.action === 'connection') {
      if (!member?.is_admin) throw new MetaError(403, 'Yönetici yetkisi gerekli.')
      if (!/^\d+$/.test(dataset) || !accessToken) throw new MetaError(503, 'Sunucu dataset veya CAPI anahtarı eksik.')
      await graphGet(`${dataset}?fields=id`, accessToken, version, fetcher)
      return json({ success: true, message: 'Dataset okunabildi; olay teslimi ve eşleşme henüz doğrulanmadı.' }, 200, origin)
    }
    if (input.action === 'pull') {
      if (!member?.is_admin || !settings.security_ready) throw new MetaError(403, 'Güvenli geçiş ve yönetici yetkisi gerekli.')
      const from = Date.parse(input.from), to = Date.parse(input.to)
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to-from > 31*86400000) throw new MetaError(400, 'En fazla 31 günlük geçerli tarih aralığı seçin.')
      const pageId = env('META_PAGE_ID'), pageToken = env('META_PAGE_ACCESS_TOKEN')
      if (!/^\d+$/.test(pageId) || !pageToken) throw new MetaError(503, 'Sunucuda Meta sayfa ayarları eksik.')
      // İşlem süresi sınırlı: her çağrı tek form sayfası işler; eksiklikler gizlenmez.
      const cursor = input.cursor ? String(input.cursor) : ''
      if (cursor.length > 2048) throw new MetaError(400, 'Geçersiz sayfalama imleci.')
      const formId = input.formId ? String(input.formId) : ''
      if (!formId) {
        const forms = await graphGet(`${pageId}/leadgen_forms?fields=id,name&limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`, pageToken, version, fetcher)
        if (forms.paging?.next && !forms.paging?.cursors?.after) throw new MetaError(502, 'Meta form sayfalama imleci eksik.')
        return json({ forms: forms.data || [], cursor: forms.paging?.next ? forms.paging.cursors.after : null }, 200, origin)
      }
      if (!/^\d+$/.test(formId)) throw new MetaError(400, 'Form kimliği geçersiz.')
      // Sayfanın formu olduğu sunucuda doğrulanır; istemcinin form adına güvenilmez.
      const form = await graphGet(`${formId}?fields=id,name,page_id`, pageToken, version, fetcher)
      if (String(form.id) !== formId || String(form.page_id) !== pageId) throw new MetaError(403, 'Formun yapılandırılmış sayfaya ait olduğu doğrulanamadı.')
      const leads = await graphLeadGet(`${formId}/leads?limit=25&since=${Math.floor(from/1000)}&until=${Math.floor(to/1000)}${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`, pageToken, version, fetcher)
      let processed = 0
      const savedLeads: any[] = []
      for (const details of leads.data || []) {
        if (!/^\d{1,32}$/.test(String(details.id)) || Date.parse(details.created_time) < from || Date.parse(details.created_time) > to) continue
        const { data: savedId, error } = await db.rpc('meta_ingest_lead', { p: normalizeLead(details, { leadgen_id: details.id, form_id: form.id, page_id: pageId }, form.name) })
        if (error) throw new MetaError(503, 'Aktarım kısmen kaydedilmiş olabilir; güvenli tekrar için aynı kapsamı yeniden çalıştırın.')
        const { data: saved, error: readError } = await db.from('leads').select('*').eq('id', savedId).single()
        if (readError) throw new MetaError(503, 'Başvuru kaydedildi; CRM görünümü okunamadı. Aynı kapsam güvenle tekrar alınabilir.')
        savedLeads.push(saved)
        processed++
      }
      if (leads.paging?.next && !leads.paging?.cursors?.after) throw new MetaError(502, 'Meta sayfalama imleci eksik; aktarım tamamlandı sayılmadı.')
      return json({ processed, leads: savedLeads, cursor: leads.paging?.next ? leads.paging?.cursors?.after : null }, 200, origin)
    }
    const mode = deliveryMode(settings, input.action)
    if (env('META_TEST_ONLY') === 'true' && input.action === 'enqueue') throw new MetaError(409, 'Bu ortam yalnızca Test Events kabul eder; canlı gönderim kilitli.')
    if (!/^\d+$/.test(dataset) || !accessToken) throw new MetaError(503, 'Sunucu dataset veya CAPI anahtarı eksik.')
    let eventId: string | null = null
    if (input.action === 'enqueue' || input.action === 'test') {
      if (typeof input.leadId !== 'string' || input.leadId.length > 200) throw new MetaError(400, 'Müşteri kimliği geçersiz.')
      if (!Number.isSafeInteger(input.revision) || input.revision < 0 || !['Contact','QualifiedLead','DisqualifiedLead','Schedule'].includes(input.eventName)) throw new MetaError(400, 'Güncel aşama sürümü ve olay türü gerekli.')
      if (input.leadgenId !== undefined && input.leadgenId !== null && (typeof input.leadgenId !== 'string' || !/^\d{1,32}$/.test(input.leadgenId))) throw new MetaError(400, 'Meta başvuru kimliği geçersiz.')
      if (input.action === 'test' && (!member?.is_admin || !env('META_TEST_EVENT_CODE'))) throw new MetaError(409, 'Yönetici ve sunucuda test olay kodu gerekli.')
      const { data, error } = await db.rpc('meta_enqueue_checked', { p_user: userId, p_lead: input.leadId,
        p_test: input.action === 'test', p_revision: input.revision, p_event: input.eventName, p_leadgen_id: input.leadgenId || null })
      if (error) throw new MetaError(409, error.message?.includes('meta_source_selection_required')
        ? 'Birden fazla Meta başvurusu var. Sonucu göndereceğiniz form/başvuruyu seçin.'
        : 'Kayıt gönderime uygun değil: seçili başvuru, yetki, aşama veya geçmiş aktarımını kontrol edin.')
      eventId = data
      if (input.retry === true) {
        const { error: retryError } = await db.rpc('meta_request_retry', { p_user: userId, p_event: eventId })
        if (retryError) throw new MetaError(409, 'Olay yeniden denenemiyor. Deneme sınırını kontrol edin; kalıcı ret için yönetici gerekir.')
      }
    } else if (input.action !== 'process' || !worker) throw new MetaError(403, 'İşlem yetkisiz.')
    const { data: jobs, error: claimError } = await db.rpc('meta_claim', { p_id: eventId, p_test_only: mode.testOnly })
    if (claimError) throw new MetaError(503, 'Kuyruk alınamadı.')
    for (const row of jobs || []) {
      let result: any
      let httpStatus = 0, body: any = null
      try {
        if ((!settings.enabled || env('META_TEST_ONLY') === 'true') && !row.test_mode) throw new MetaError(409, 'Canlı gönderim kapalı.')
        const event = row.payload || await buildCapiEvent(row)
        if (!row.payload) {
          const { data, error } = await db.from('meta_outbox').update({ payload: event }).eq('id', row.id).eq('lease_id', row.lease_id).select('id').single()
          if (error || !data) throw new Error('Payload kaydedilemedi.')
        }
        // Kuyrukta çok bekleyen olayı günümüze taşıyarak uydurma zaman üretmeyin.
        if (Date.now()/1000 - event.event_time > 7*86400) throw new MetaError(422, 'Olay zaman penceresi aşıldı.')
        if (row.test_mode && !env('META_TEST_EVENT_CODE')) throw new MetaError(422, 'Test olay kodu eksik.')
        const response = await fetcher(`https://graph.facebook.com/${version}/${dataset}/events`, {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [event], ...(row.test_mode ? { test_event_code: env('META_TEST_EVENT_CODE') } : {}) }),
          signal: AbortSignal.timeout(12000),
        })
        httpStatus = response.status
        body = await response.json().catch(() => null)
        result = deliveryResult(httpStatus, body, row.attempt)
      } catch (error) {
        result = error instanceof MetaError ? { state: 'rejected', received: 0, retrySeconds: null, trace: null } : deliveryResult(0, null, row.attempt)
      }
      // Meta hata mesajı kişisel veri/anahtar içerebilir; yalnızca sayısal teşhis alanları kalıcı tutulur.
      const { error } = await db.rpc('meta_finish', { p_id: row.id, p_lease: row.lease_id,
        p_result: { ...result, httpStatus, code: body?.error?.code || null, subcode: body?.error?.error_subcode || null,
          errorCode: result.state === 'sent' ? null : `META_${httpStatus}_${body?.error?.code || 'VALIDATION_OR_NETWORK'}` } })
      if (error) throw new MetaError(503, 'Teslim sonucu kaydedilemedi; aynı olay kimliğiyle kurtarılacak.')
    }
    if (!eventId) return json({ processed: jobs?.length || 0 }, 200, origin)
    const { data: event, error } = await db.from('meta_outbox').select('id,lead_id,meta_leadgen_id,revision,event_name,state,attempt,next_attempt_at,last_attempt_at,sent_at,events_received,fbtrace_id,error_code,test_mode').eq('id', eventId).single()
    if (error) throw new MetaError(503, 'Teslim sonucu okunamadı.')
    return json({ event }, 200, origin)
  } catch (error) {
    return json({ error: error instanceof MetaError ? error.message : 'Meta işlemi tamamlanamadı.' }, error instanceof MetaError ? error.status : 503, origin)
  }
}
}

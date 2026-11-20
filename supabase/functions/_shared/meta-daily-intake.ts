import { graphGet, graphLeadGet, graphVersion, leadRangePath, normalizeLead } from './meta-core.ts'
import { resolveMetaPageAccess } from './meta-page-access.ts'

export function createDailyIntakeHandler(deps: { env: (name: string) => string; createClient: (...args: any[]) => any; fetcher?: typeof fetch }) {
  return async (req: Request) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const token = req.headers.get('x-cron-token') || ''
    if (!/^[a-f0-9]{64}$/.test(token)) return new Response('Unauthorized', { status: 401 })
    const db = deps.createClient(deps.env('SUPABASE_URL'), deps.env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const claim = await db.rpc('meta_daily_intake_claim', { p_token: token })
    if (claim.error) return new Response('Unauthorized', { status: 401 })
    const job = claim.data
    if (!job) return new Response(null, { status: 204 })
    let pages = 0, processed = 0
    const state = structuredClone(job.state || {})
    const started = Date.now()
    try {
      const version = graphVersion(deps.env('META_GRAPH_VERSION'))
      const access = await resolveMetaPageAccess(deps.env, version, deps.fetcher)
      const from = Date.parse(job.from), to = Date.parse(job.to)
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw Error('invalid_range')
      while (pages < 8 && Date.now() - started < 45000 && !state.done) {
        if (!state.listed) {
          const forms = await graphGet(`${access.pageId}/leadgen_forms?fields=id,name&limit=100${state.formCursor ? `&after=${encodeURIComponent(state.formCursor)}` : ''}`, access.token, version, deps.fetcher)
          if (!Array.isArray(forms.data)) throw Error('invalid_forms')
          const next = forms.paging?.next ? forms.paging?.cursors?.after : null
          if (forms.paging?.next && (!next || next === state.formCursor)) throw Error('invalid_form_cursor')
          state.forms = forms.data; state.index = 0; state.nextFormCursor = next; state.listed = true
        }
        if (state.index >= state.forms.length) {
          if (!state.nextFormCursor) { state.done = true; break }
          state.formCursor = state.nextFormCursor; state.listed = false; continue
        }
        const form = state.forms[state.index]
        if (!/^\d{1,32}$/.test(form.id)) throw Error('invalid_form')
        const data = await graphLeadGet(leadRangePath(form.id, from, to, state.leadCursor || ''), access.token, version, deps.fetcher)
        if (!Array.isArray(data.data)) throw Error('invalid_leads')
        for (const details of data.data) {
          const at = Date.parse(details.created_time)
          if (!Number.isFinite(at)) throw Error('invalid_submission_time')
          if (at < from || at > to) continue
          const p = normalizeLead(details, { leadgen_id: details.id, form_id: form.id, page_id: access.pageId }, form.name)
          const saved = await db.rpc('meta_ingest_lead', { p })
          if (saved.error || !saved.data) throw Error('ingest_failed')
          processed++
        }
        const next = data.paging?.next ? data.paging?.cursors?.after : null
        if (data.paging?.next && (!next || next === state.leadCursor)) throw Error('invalid_lead_cursor')
        state.leadCursor = next
        if (!next) state.index++
        pages++
      }
      if (state.listed && state.index >= state.forms.length && !state.nextFormCursor) state.done = true
      const finish = await db.rpc('meta_daily_intake_finish', { p_date: job.date, p_lease: job.lease,
        p_state: state, p_complete: !!state.done, p_pages: pages, p_processed: processed, p_error: false })
      if (finish.error) throw Error('checkpoint_failed')
      return Response.json({ complete: !!state.done, pages, processed })
    } catch {
      await db.rpc('meta_daily_intake_finish', { p_date: job.date, p_lease: job.lease,
        p_state: {}, p_complete: false, p_pages: 0, p_processed: 0, p_error: true })
      return Response.json({ error: 'intake_failed_retry_scheduled' }, { status: 503 })
    }
  }
}

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const origins = new Set(['null', 'http://localhost:9002', 'http://127.0.0.1:9002',
  ...(Deno.env.get('CRM_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)])
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

// Call only with a bearer verified by Auth, or a new token just issued by Auth.
function sessionId(token: string): string {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const id = JSON.parse(atob(payload)).session_id
  if (typeof id !== 'string' || !uuid.test(id)) throw Error('invalid_session')
  return id
}

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  }
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (origin && !origins.has(origin)) return respond(403, { error: 'origin_denied' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' })
  const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!token) return respond(401, { error: 'authentication_required' })

  try {
    const raw = await request.text()
    if (raw.length > 1024) return respond(413, { error: 'invalid_request' })
    const body = JSON.parse(raw)
    if (!uuid.test(body.requestId) || typeof body.userId !== 'string' || !body.userId || body.userId.length > 128)
      return respond(400, { error: 'invalid_request' })

    const url = Deno.env.get('SUPABASE_URL')!
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options).auth
    const { data: actor, error: signInError } = await auth.getUser(token)
    if (signInError || !actor.user) return respond(401, { error: 'authentication_required' })
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options)
    const { data: target, error: denied } = await service.rpc('crm_begin_account_switch', {
      p_actor: actor.user.id, p_session: sessionId(token), p_id: body.userId, p_request: body.requestId,
    })
    if (denied) {
      if (denied.code === '23505') return respond(409, { error: 'request_already_used' })
      if (denied.message.includes('crm_rate_limited')) return respond(429, { error: 'rate_limited' })
      return respond(denied.code === '42501' ? 403 : 503, { error: 'switch_unavailable' })
    }
    const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: target.email })
    if (linkError || link.user?.id !== target.authId || !link.properties?.hashed_token)
      return respond(503, { error: 'switch_unavailable' })
    const { data, error } = await auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token })
    const session = data.session
    if (!session || error) return respond(503, { error: 'switch_unavailable' })
    let granted = false
    try {
      if (session.user.id !== target.authId) return respond(403, { error: 'switch_unavailable' })
      const { error: auditError } = await service.rpc('crm_finish_account_switch', {
        p_request: body.requestId, p_target: target.authId, p_session: sessionId(session.access_token),
      })
      if (auditError) return respond(403, { error: 'switch_unavailable' })
      granted = true
      return respond(200, { userId: body.userId, authId: target.authId,
        access_token: session.access_token, refresh_token: session.refresh_token })
    } finally {
      if (!granted) await service.auth.admin.signOut(session.access_token, 'local')
    }
  } catch {
    return respond(400, { error: 'switch_incomplete' })
  }
})

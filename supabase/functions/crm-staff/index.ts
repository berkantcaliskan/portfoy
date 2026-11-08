import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const origins = new Set((Deno.env.get('CRM_ALLOWED_ORIGINS') || 'http://127.0.0.1:9002,http://localhost:9002').split(','))
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(15000) })

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  }
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (origin && !origins.has(origin)) return respond(403, { error: 'origin_denied' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' })
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return respond(401, { error: 'authentication_required' })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!url || !anon || !serviceKey) return respond(503, { error: 'configuration_missing' })
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authorization }, fetch: boundedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7))
    if (identityError || !identity.user) return respond(401, { error: 'authentication_required' })
    const { data: profile, error: profileError } = await client.rpc('crm_get_my_profile').abortSignal(AbortSignal.timeout(15000))
    if (profileError || profile?.role !== 'ADMIN') return respond(403, { error: 'crm_forbidden' })
    const raw = await request.text()
    if (raw.length > 4096) return respond(413, { error: 'invalid_input' })
    const input = JSON.parse(raw)
    if (typeof input.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.requestId)) return respond(400, { error: 'invalid_input' })
    const secret = createClient(url, serviceKey, { global: { fetch: boundedFetch }, auth: { persistSession: false, autoRefreshToken: false } })
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    const password = 'Aa1!' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    if (input.action === 'reset-password') {
      const { data: target, error: targetError } = await client.rpc('crm_staff_reset_target', { p_id: input.userId, p_request: input.requestId })
      if (targetError || !target?.auth_user_id) return respond(403, { error: 'crm_forbidden' })
      const { error: resetError } = await secret.auth.admin.updateUserById(target.auth_user_id, { password })
      if (resetError) return respond(503, { error: 'password_reset_failed' })
      const { error: stateError } = await secret.rpc('crm_finish_staff_reset', { p_actor: identity.user.id, p_auth_user: target.auth_user_id, p_request: input.requestId, p_lease: target.lease_id })
      if (stateError) return respond(503, { error: 'password_reset_incomplete' })
      return respond(200, { user: { id: input.userId, username: target.username }, generatedPassword: password })
    }
    const { data: operation, error: prepareError } = await client.rpc('crm_prepare_staff', {
      p_request: input.requestId, p_username: input.username, p_name: input.fullName,
      p_department: input.department, p_role: input.role || 'MEMBER', p_scope: input.scope || 'ASSIGNED_ONLY',
    }).abortSignal(AbortSignal.timeout(15000))
    if (prepareError) return respond(400, { error: prepareError.message.includes('crm_username_taken') ? 'username_taken' : 'staff_request_rejected' })
    if (operation.auth_user_id) return respond(409, { error: 'account_already_created' })
    const { data: created, error: createError } = await secret.auth.admin.createUser({
      email: `${operation.username}@staff.demirturk.invalid`, password, email_confirm: true,
      app_metadata: { crm_staff_request: input.requestId },
    })
    let userId = created.user?.id
    if (createError || !userId) {
      const { data: pendingId, error: pendingError } = await secret.rpc('crm_pending_staff_auth', { p_actor: identity.user.id, p_request: input.requestId })
      if (pendingError || !pendingId) return respond(409, { error: 'auth_account_creation_failed' })
      const { error: retryError } = await secret.auth.admin.updateUserById(pendingId, { password })
      if (retryError) return respond(503, { error: 'auth_account_creation_failed' })
      userId = pendingId
    }
    const { data: staff, error: finalizeError } = await secret.rpc('crm_finalize_staff', {
      p_actor: identity.user.id, p_request: input.requestId, p_auth_user: userId, p_lease: operation.lease_id,
    }).abortSignal(AbortSignal.timeout(15000))
    if (finalizeError) return respond(503, { error: 'staff_mapping_incomplete' })
    return respond(200, { user: staff, generatedPassword: password })
  } catch {
    return respond(500, { error: 'staff_operation_failed' })
  }
})

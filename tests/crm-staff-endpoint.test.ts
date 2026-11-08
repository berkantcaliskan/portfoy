import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function setup(mode: 'create' | 'recover' | 'used' | 'processing') {
  let handler!: (request: Request) => Promise<Response>
  const calls: string[] = []
  const authId = '10000000-0000-0000-0000-000000000001'
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } }, error: null }) },
    rpc(name: string) {
      calls.push(name)
      const result = name === 'crm_get_my_profile' ? { data: { role: 'ADMIN' }, error: null }
        : name === 'crm_prepare_staff' ? mode === 'processing'
          ? { error: { message: 'crm_operation_processing' } }
          : { data: { username: 'isolated', auth_user_id: mode === 'create' ? null : authId, lease_id: 'lease' }, error: null }
        : mode === 'used' ? { error: { message: 'crm_creation_already_used' } }
        : { data: { auth_user_id: authId, username: 'isolated', lease_id: 'reset-lease' }, error: null }
      return { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve), abortSignal: async () => result }
    },
  }
  const secret = {
    auth: { admin: {
      createUser: async (input: any) => { calls.push('createUser'); assert.match(input.password, /^Aa1![0-9a-f]{36}$/); return { data: { user: { id: authId } }, error: null } },
      updateUserById: async (_id: string, input: any) => { calls.push('updatePassword'); assert.match(input.password, /^Aa1![0-9a-f]{36}$/); return { error: null } },
    } },
    rpc: (name: string) => {
      calls.push(name)
      const result = { data: { id: 'auth-' + authId, username: 'isolated' }, error: null }
      return { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve), abortSignal: async () => result }
    },
  }
  const source = fs.readFileSync(new URL('../supabase/functions/crm-staff/index.ts', import.meta.url), 'utf8')
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, require: () => ({ createClient: (_url: string, key: string) => key === 'private-key' ? secret : client }),
    Deno: { env: { get: (name: string) => ({ SUPABASE_URL: 'https://isolated.invalid', SUPABASE_ANON_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'private-key' } as any)[name] }, serve: (value: typeof handler) => { handler = value } },
    crypto, Request, Response, AbortSignal, fetch: () => { throw Error('Unexpected external request') },
  })
  const send = () => handler(new Request('https://isolated.invalid/crm-staff', {
    method: 'POST', headers: { origin: 'http://localhost:9002', authorization: 'Bearer isolated-test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: crypto.randomUUID(), username: 'isolated', fullName: 'Isolated staff', department: 'Satış' }),
  }))
  return { send, calls, authId }
}

test('Personel endpointi parolayı otomatik üretir ve tamamlanmış hesapla döndürür', async () => {
  const h = setup('create'), response = await h.send(), body = await response.json()
  assert.equal(response.status, 200)
  assert.match(body.generatedPassword, /^Aa1![0-9a-f]{36}$/)
  assert.equal(body.user.id, 'auth-' + h.authId)
  assert.equal(h.calls.filter(name => name === 'createUser').length, 1)
})
test('Kayıp yanıt sonrası aynı ilk hesap kurtarılır; ikinci Auth hesabı açılmaz', async () => {
  const h = setup('recover'), response = await h.send(), body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.recovered, true)
  assert.equal(body.user.id, 'auth-' + h.authId)
  assert.equal(h.calls.includes('createUser'), false)
  assert.equal(h.calls.includes('crm_finish_staff_reset'), true)
})
test('Kullanıcının değiştirdiği parola oluşturma tekrarıyla ezilmez', async () => {
  const h = setup('used'), response = await h.send()
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error, 'account_already_created')
  assert.equal(h.calls.includes('updatePassword'), false)
})
test('Süren oluşturma işlemi hata kodunu kaybetmeden bildirilir', async () => {
  const h = setup('processing'), response = await h.send()
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error, 'crm_operation_processing')
  assert.equal(h.calls.includes('createUser'), false)
})

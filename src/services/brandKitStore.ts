import { userStore } from './userStore'
import { createCrmServerCollection } from './crmServerCollection'
import { CrmBackendError } from './crmBackendRepository'

type Document = { id: string; [key: string]: unknown }
const backend = createCrmServerCollection<Document>('brand_kit', () => {
  const user = userStore.getCurrentUser(), client = userStore.getServerClient()
  return user && client ? { id: user.id, client } : null
}, { refreshAfterWrite: false })
let account: string | null = null
let draft: Document | null = null
let version = 0
let dirty = false
let error = ''
let saving: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let pending: { key: string; value: Document; version: number } | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
backend.subscribe(notify)

export const brandKitStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  setAccount(id: string | null) {
    if (id === account) return
    account = id; draft = null; pending = null; dirty = false; error = ''; version++
    if (timer) clearTimeout(timer)
    backend.setAccount(id)
    notify()
  },
  get() { return structuredClone(draft || backend.getAll()[0] || null) },
  state() { return { dirty, saving: Boolean(saving), error: error || backend.getError() } },
  async refreshFromBackend() { if (!dirty && !saving) await backend.refresh() },
  save(value: Record<string, unknown>) {
    if (!account || userStore.getCurrentUser()?.id !== account) throw Error('Sunucu oturumu gerekli.')
    draft = structuredClone({ ...value, id: 'brand-kit' }); dirty = true; version++
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void this.flush().catch(() => {}) }, 600)
    notify()
  },
  async flush(): Promise<void> {
    if (saving) return saving
    if (timer) clearTimeout(timer)
    const actor = account
    const run = async () => {
      error = ''
      while (dirty && draft && actor === account) {
        if (!pending) pending = { key: JSON.stringify(draft), value: structuredClone(draft), version }
        const sent = pending
        const saved = await backend.save(sent.key, sent.value)
        if (actor !== account) return
        pending = null
        if (sent.version === version) { draft = saved; dirty = false }
      }
    }
    saving = run()
    notify()
    try { await saving } catch (cause) {
      if (actor === account) {
        error = cause instanceof Error ? cause.message : 'Marka kiti kaydedilemedi.'
        if (cause instanceof CrmBackendError && !['request_failed', 'invalid_response'].includes(cause.code)) pending = null
      }
      throw cause
    } finally { saving = null; notify() }
  },
  async reload() {
    if (saving) throw Error('Önce kayıt işlemini bekleyin.')
    draft = null; pending = null; dirty = false; error = ''
    backend.setAccount(null); backend.setAccount(account)
    await backend.refresh()
    notify()
  },
}
if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = '' }
})

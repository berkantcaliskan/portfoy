import type { SupabaseClient } from '@supabase/supabase-js'
import { CrmBackendError, createCrmBackendRepository, type CrmBackendModule, type CrmWriteCommand } from './crmBackendRepository'

export function createCrmServerCollection<T extends { id: string }>(
  module: CrmBackendModule,
  context: () => { id: string; client: SupabaseClient } | null,
  options: { refreshAfterWrite?: boolean } = {},
) {
  let account: string | null = null
  let generation = 0
  let readSequence = 0
  let records = new Map<string, { value: T; revision: number }>()
  let pending: { key: string; command: CrmWriteCommand } | null = null
  let writing = false
  let errorMessage = ''
  const listeners = new Set<() => void>()
  const createFingerprint = (value: unknown) => {
    const root = { ...(value as Record<string, unknown>) }
    for (const key of ['id', 'createdAt', 'updatedAt']) delete root[key]
    return JSON.stringify(root, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item)
  }
  const notify = () => listeners.forEach(listener => listener())
  const repository = () => {
    const active = context()
    if (!active || active.id !== account) throw new Error('Sunucu oturumunu yeniden doğrulayın.')
    return createCrmBackendRepository(active.client)
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setAccount(id: string | null) {
      if (account === id) return
      account = id
      generation++
      records.clear()
      pending = null
      errorMessage = ''
      notify()
    },
    getAll(): T[] {
      if (context()?.id !== account) return []
      return Array.from(records.values(), row => structuredClone(row.value))
    },
    getError() { return errorMessage },
    async refresh() {
      if (!account || writing) return
      const ticket = generation
      const sequence = ++readSequence
      const loaded = new Map<string, { value: T; revision: number }>()
      const cursors = new Set<string>()
      try {
        const remote = repository()
        let cursor: string | null = ''
        do {
          if (cursors.has(cursor)) throw new Error('Sunucu sayfalaması doğrulanamadı.')
          cursors.add(cursor)
          const page = await remote.list(module, cursor, 100)
          if (ticket !== generation || sequence !== readSequence) return
          for (const row of page.records) {
            if (row.payload.id !== row.id) throw new Error('Sunucu kayıt kimliği doğrulanamadı.')
            loaded.set(row.id, { value: row.payload as unknown as T, revision: row.revision })
          }
          cursor = page.next
        } while (cursor !== null)
        records = loaded
        errorMessage = ''
      } catch (error) {
        if (ticket !== generation || sequence !== readSequence) return
        if (error instanceof CrmBackendError && ['crm_forbidden', 'crm_identity_not_assigned', 'authentication_required'].includes(error.code)) records.clear()
        errorMessage = error instanceof Error ? error.message : 'Sunucu kayıtları okunamadı.'
      }
      notify()
    },
    async save(key: string, value: T, archive = false, approvalDecision = false, fileNotes = false): Promise<T> {
      if (writing) throw new Error('Önceki kayıt işlemi sürüyor.')
      const retryOfCreate = pending && pending.command.revision === 0 && !archive && !records.has(value.id)
        && createFingerprint(value) === createFingerprint(pending.command.payload)
      if (pending && pending.key !== key && !retryOfCreate) throw new Error('Sonucu belirsiz işlemi aynı bilgilerle yeniden deneyin.')
      const remote = repository()
      const ticket = generation
      const command: CrmWriteCommand = pending?.command ?? {
        module, id: value.id, revision: records.get(value.id)?.revision ?? 0,
        payload: structuredClone(value) as unknown as Record<string, unknown>,
        requestId: crypto.randomUUID(), archive,
      }
      pending = { key, command }
      writing = true
      readSequence++
      try {
        const saved = await remote.write(command, approvalDecision, fileNotes)
        if (ticket !== generation) throw new Error('Kayıt sırasında oturum değişti.')
        const result = (saved.payload || command.payload) as unknown as T
        if (archive) records.delete(command.id)
        else records.set(command.id, { value: structuredClone(result), revision: saved.revision })
        pending = null
        errorMessage = ''
        notify()
        return structuredClone(result)
      } catch (error) {
        if (ticket === generation) {
          errorMessage = error instanceof Error ? error.message : 'Kayıt sonucu doğrulanamadı.'
          if (error instanceof CrmBackendError && !['request_failed', 'invalid_response'].includes(error.code)) pending = null
          notify()
        }
        throw error
      } finally {
        writing = false
        if (options.refreshAfterWrite !== false) void this.refresh()
      }
    },
  }
}

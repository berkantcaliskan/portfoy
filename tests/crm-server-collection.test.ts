import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { CrmBackendError } from '../src/services/crmBackendRepository.ts'

function setup() {
  let actor: string | null = 'a'
  let list: (...args: any[]) => Promise<any> = async () => ({ records: [], next: null })
  let write: (...args: any[]) => Promise<any> = async command => ({ revision: 1, payload: command.payload })
  const mod = { exports: {} as any }
  const source = fs.readFileSync(new URL('../src/services/crmServerCollection.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module: mod, exports: mod.exports, structuredClone, crypto, Error,
    require: () => ({ CrmBackendError, createCrmBackendRepository: () => ({ list: (...args: any[]) => list(...args), write: (...args: any[]) => write(...args) }) }),
  })
  const collection = mod.exports.createCrmServerCollection('projects', () => actor ? { id: actor, client: {} } : null, { refreshAfterWrite: false })
  collection.setAccount(actor)
  return { collection, actor: (id: string) => { actor = id; collection.setAccount(id) }, list: (fn: typeof list) => { list = fn }, write: (fn: typeof write) => { write = fn } }
}

test('Hesap değişiminden önce başlayan cevap yeni hesabın kayıtlarını dolduramaz', async () => {
  const h = setup()
  let finish!: (value: any) => void
  h.list(() => new Promise(resolve => { finish = resolve }))
  const read = h.collection.refresh()
  h.actor('b')
  finish({ records: [{ id: 'old', payload: { id: 'old' }, revision: 1 }], next: null })
  await read
  assert.equal(h.collection.getAll().length, 0)
})

test('Kısmi sayfalama hatası önceki tam görünümü eksik listeyle değiştirmez', async () => {
  const h = setup()
  h.list(async () => ({ records: [{ id: 'original', payload: { id: 'original' }, revision: 2 }], next: null }))
  await h.collection.refresh()
  let page = 0
  h.list(async () => { if (page++) throw new Error('network'); return { records: [{ id: 'partial', payload: { id: 'partial' }, revision: 1 }], next: 'partial' } })
  await h.collection.refresh()
  assert.equal(h.collection.getAll()[0].id, 'original')
  assert.equal(h.collection.getError(), 'network')
})

test('Belirsiz yazım aynı request kimliğiyle tekrarlanır ve sunucu payloadı kullanılır', async () => {
  const h = setup(), calls: any[] = []
  h.write(async command => { calls.push(command); if (calls.length === 1) throw new CrmBackendError('request_failed', 'unknown'); return { revision: 4, payload: { id: 'p', actor: 'server' } } })
  await assert.rejects(h.collection.save('same', { id: 'p', actor: 'client' }))
  await assert.rejects(h.collection.save('different', { id: 'q' }))
  const result = await h.collection.save('same', { id: 'p', actor: 'client' })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].requestId, calls[1].requestId)
  assert.equal(result.actor, 'server')
})

test('Yetki kaldırıldığında önceki kayıtlar görünümden temizlenir', async () => {
  const h = setup()
  h.list(async () => ({ records: [{ id: 'private', payload: { id: 'private' }, revision: 1 }], next: null }))
  await h.collection.refresh()
  h.list(async () => { throw new CrmBackendError('crm_identity_not_assigned', 'denied') })
  await h.collection.refresh()
  assert.equal(h.collection.getAll().length, 0)
})

test('Yeni kayıt formu yeniden UUID üretse de belirsiz create aynı işlemle denenir', async () => {
  const h = setup(), calls: any[] = []
  h.write(async command => {
    calls.push(command)
    if (calls.length === 1) throw new CrmBackendError('request_failed', 'unknown')
    return { revision: 1, payload: command.payload }
  })
  await assert.rejects(h.collection.save('first', { id: 'first-id', name: 'same', createdAt: 'first-time', nested: { id: 'unit-1' } }))
  await assert.rejects(h.collection.save('changed', { id: 'next-id', name: 'same', createdAt: 'next-time', nested: { id: 'unit-2' } }))
  const result = await h.collection.save('retry', { id: 'next-id', name: 'same', createdAt: 'next-time', nested: { id: 'unit-1' } })
  assert.equal(result.id, 'first-id')
  assert.equal(calls[0].requestId, calls[1].requestId)
})

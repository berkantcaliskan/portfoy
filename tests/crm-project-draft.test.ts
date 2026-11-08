import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { CrmBackendError } from '../src/services/crmBackendRepository.ts'

function setup() {
  let rows: any[] = [], calls = 0
  let deliver: (value: any) => Promise<any> = async value => JSON.parse(JSON.stringify(value))
  const collection = {
    setAccount: () => { rows = [] }, getAll: () => structuredClone(rows), getError: () => '',
    refresh: async () => {},
    save: async (_key: string, value: any, archive: boolean) => {
      if (++calls > 10) throw Error('unexpected write loop')
      const saved = await deliver(value)
      rows = archive ? rows.filter(row => row.id !== value.id) : [...rows.filter(row => row.id !== value.id), saved]
      return structuredClone(saved)
    },
  }
  const mod = { exports: {} as any }
  const source = fs.readFileSync(new URL('../src/services/projectStore.ts', import.meta.url), 'utf8')
  const mocks: any = {
    './crmBackendRepository': { CrmBackendError },
    './userStore': { userStore: { getCurrentUser: () => ({ id: 'actor' }), getServerClient: () => ({}) } },
    './crmRuntime': { isCentralCrm: () => true },
    './crmServerCollection': { createCrmServerCollection: () => collection },
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module: mod, exports: mod.exports, require: (name: string) => mocks[name] || {},
    structuredClone, crypto, setTimeout, clearTimeout, Error,
  })
  const store = mod.exports.projectStore
  store.setAccount('actor')
  const edit = (name: string) => { store.projects = [{ id: 'p', name, units: [] }]; store.saveToStorage() }
  return { store, edit, calls: () => calls, deliver: (fn: typeof deliver) => { deliver = fn } }
}

test('Postgres JSON anahtar sırası tekrar yazım döngüsü oluşturmaz', async () => {
  const h = setup()
  h.deliver(async value => ({ units: value.units, name: value.name, id: value.id }))
  h.edit('first')
  await h.store.flushToBackend()
  assert.equal(h.calls(), 1)
  assert.equal(h.store.getSyncState().dirty, false)
})

test('Yazım sırasında yapılan yeni proje düzenlemesi kaybolmaz', async () => {
  const h = setup()
  let finish!: (value: any) => void
  h.deliver(value => new Promise(resolve => { finish = () => resolve(value) }))
  h.edit('first')
  const pending = h.store.flushToBackend()
  h.edit('second')
  h.deliver(async value => value)
  finish(null)
  await pending
  assert.equal(h.calls(), 2)
  assert.equal(h.store.getAll()[0].name, 'second')
})

test('Sunucu reddi taslağı kaydedildi göstermez', async () => {
  const h = setup()
  h.deliver(async () => { throw new CrmBackendError('crm_revision_conflict', 'conflict') })
  h.edit('unsaved')
  await assert.rejects(h.store.flushToBackend())
  assert.equal(h.store.getSyncState().dirty, true)
  assert.equal(h.store.getSyncState().error, 'conflict')
})

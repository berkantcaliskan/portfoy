import test from 'node:test'
import assert from 'node:assert/strict'
import { assertServerReady, REQUIRED_SERVER_VERSION, assertMetaIntakeReady, REQUIRED_META_INTAKE_VERSION } from '../scripts/check-server-ready.mjs'
import { createPromissoryRepository } from '../src/services/promissoryRepository.ts'

test('Sunucu eksik, eski veya doğrulanmamışken güncelleme yayımlanamaz', () => {
  for (const data of [null, {}, { ready: true, missing: [] }, { version: REQUIRED_SERVER_VERSION - 1, ready: true, missing: [] }, { version: REQUIRED_SERVER_VERSION, ready: false, missing: ['office'] }, { version: REQUIRED_SERVER_VERSION, ready: true, missing: ['files'] }]) assert.throws(() => assertServerReady(data), /Yayın durduruldu/)
  assert.doesNotThrow(() => assertServerReady({ version: REQUIRED_SERVER_VERSION, ready: true, missing: [] }))
})
test('Dağıtım, kişisel erişim, çöp kutusu ve Realtime kurulmadan yeni sürüm yayımlanamaz', () => {
  const ready = { version: REQUIRED_META_INTAKE_VERSION, assignment: true, persistent_cursor: true, stage_updates: true, lead_trash: true, personal_visibility: true, archive_visibility: true, realtime: true }
  assert.doesNotThrow(() => assertMetaIntakeReady(ready))
  for (const field of Object.keys(ready).filter(key => key !== 'version')) assert.throws(() => assertMetaIntakeReady({ ...ready, [field]: false }))
  assert.throws(() => assertMetaIntakeReady({ ...ready, version: REQUIRED_META_INTAKE_VERSION - 1 }))
  assert.throws(() => assertMetaIntakeReady(null))
})
test('Senet kaydı başarısız yanıtı kalıcı başarı saymaz; aynı istek kimliğini korur', async () => {
  const payload: any = { details: { issuerName: 'İzole kişi' }, notes: [{ cents: 100 }], financing: {} }
  const requests: any[] = []
  const repo = createPromissoryRepository({ rpc: (_name, args) => ({ abortSignal: async () => { requests.push(args); return { data: { id: 'note-id', revision: 1, payload } } } }) })
  await repo.save('same-request', 'note-id', 0, payload); await repo.save('same-request', 'note-id', 0, payload)
  assert.deepEqual(requests[0], requests[1])
  const broken = createPromissoryRepository({ rpc: () => ({ abortSignal: async () => ({ data: { id: 'note-id', revision: 0 } }) }) })
  await assert.rejects(broken.save('request', 'note-id', 0, payload), /doğrulanamadı/)
  const denied = createPromissoryRepository({ rpc: () => ({ abortSignal: async () => ({ error: { message: 'note_forbidden' } }) }) })
  await assert.rejects(denied.list(), /ADMIN erişimi/)
})

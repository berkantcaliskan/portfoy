import test from 'node:test'
import assert from 'node:assert/strict'
import { createFrontOfficeRepository } from '../src/services/frontOfficeRepository.ts'
import { contractDocument } from '../src/components/frontoffice/contractDocument.ts'
import { sortOfficePeople } from '../src/types/frontOffice.ts'

test('Personel listesi öncelikli departman, diğer departmanlar ve Türkçe ad sırasıyla dizilir', () => {
  const people = [{ id: '1', department: 'Satış', name: 'Özge' }, { id: '2', department: 'Müşteri İlişkileri', name: 'Tuğçe' }, { id: '3', department: 'Muhasebe', name: 'Özlem' }, { id: '4', department: 'Müşteri İlişkileri', name: 'İlknur' }, { id: '5', department: 'Satış', name: 'Ali' }]
  assert.deepEqual(sortOfficePeople(people, 'Müşteri İlişkileri').map(person => person.id), ['4', '2', '3', '5', '1'])
  assert.deepEqual(sortOfficePeople(people, 'Satış').map(person => person.id), ['5', '1', '3', '4', '2'])
})

function client(run: (name: string, args: any) => any) {
  return { rpc: (name: string, args: any) => ({ abortSignal: async () => run(name, args) }) }
}
test('Ön Ofis listesi tüm sayfaları okur, yinelenen cursor döngüsünü reddeder', async () => {
  const make = (id: string) => ({ id, kind: 'visitors', revision: 1, payload: { name: 'İzole müşteri' } })
  const repo = createFrontOfficeRepository(client((_name, args) => ({ data: args.p_after ? { records: [make('b')], hasMore: false } : { records: [make('a')], hasMore: true } })))
  assert.deepEqual((await repo.list('visitors')).map(row => row.id), ['a', 'b'])
  const broken = createFrontOfficeRepository(client(() => ({ data: { records: [make('a')], hasMore: true } })))
  await assert.rejects(broken.list('visitors'), /sayfalaması/)
})
test('Kaydetme aynı işlem kimliğini sunucuya iletir; eksik cevap başarı sayılmaz', async () => {
  const command = { requestId: 'same-request', id: 'same-record', kind: 'visitors' as const, revision: 4, payload: { name: 'Ad', phone: '0', notes: '', status: 'WAITING' } }
  const calls: any[] = []
  const repo = createFrontOfficeRepository(client((name, args) => { calls.push({ name, args }); return { data: { id: 'same-record', kind: 'visitors', revision: 5, payload: command.payload } } }))
  await repo.save(command); await repo.save(command)
  assert.equal(calls[0].args.p_request, 'same-request'); assert.deepEqual(calls[0], calls[1])
  const broken = createFrontOfficeRepository(client(() => ({ data: { id: 'same-record', revision: 4 } })))
  await assert.rejects(broken.save(command), /doğrulanamadı/)
})
test('Sunucu kurulumu ve yetki reddi gerçek başarıya dönüşmez', async () => {
  const missing = createFrontOfficeRepository(client(() => ({ error: { code: 'PGRST202' } })))
  await assert.rejects(missing.context(), /kurulumu henüz uygulanmamış/)
  const denied = createFrontOfficeRepository(client(() => ({ error: { message: 'office_forbidden' } })))
  await assert.rejects(denied.assign('user', true), /erişiminiz yok/)
})
test('Sözleşme belgesi HTML girişini çalıştırmaz ve iç notları basmaz', () => {
  const html = contractDocument({ name: '<script>bad()</script>', phone: '0', status: 'DRAFT', notes: 'INTERNAL_SECRET', title: 'Sözleşme', body: '<img src=x onerror=bad()>', beneficiary: 'Firma' })
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('INTERNAL_SECRET'))
})

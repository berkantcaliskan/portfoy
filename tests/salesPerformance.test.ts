import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSalesRanking } from '../src/utils/salesPerformance.ts'

const people = [
  { id: 'hazal', fullName: 'Hazal', department: 'Satış' },
  { id: 'levent', fullName: 'Levent', department: 'Satış' },
  { id: 'ertugrul', fullName: 'Ertuğrul', department: 'Satış' },
]
function sale(id: string, name = id, price = 1) {
  return { status: 'SATILDI' as const, sale: { soldByUserId: id, soldByUserName: name, salePrice: price, customerName: '', soldAt: '2026-11-18' } }
}

test('Satış payı satış adedinden hesaplanır, tutar ve kullanıcı sırası sonucu değiştirmez', () => {
  const ranking = buildSalesRanking([
    sale('hazal', 'Hazal', 10), sale('hazal', 'Hazal', 10),
    sale('levent', 'Levent', 1_000_000), { status: 'SATISTA' },
  ], people)
  assert.deepEqual(ranking.map(row => [row.id, row.count]), [['hazal', 2], ['levent', 1], ['ertugrul', 0]])
  assert.equal(ranking[0].percentage, 2 / 3 * 100)
  assert.equal(ranking[1].percentage, 1 / 3 * 100)
})
test('Eski ve danışmanı belirtilmemiş satışlar toplamda bir kez sayılır', () => {
  const legacy = sale('', 'Levent')
  const ranking = buildSalesRanking([legacy, sale('old', 'Eski danışman'), { status: 'SATILDI' }], people)
  assert.equal(ranking.reduce((sum, row) => sum + row.count, 0), 3)
  assert.equal(ranking.find(row => row.id === 'levent')?.count, 1)
  assert.equal(ranking.find(row => row.id === 'unassigned')?.count, 1)
  assert.ok(Math.abs(ranking.reduce((sum, row) => sum + row.percentage, 0) - 100) < 0.0001)
})
test('Satış yoksa tüm paylar sıfırdır, eşit satışlar isim sırasındadır', () => {
  assert.ok(buildSalesRanking([], people).every(row => row.percentage === 0))
  assert.deepEqual(buildSalesRanking([sale('levent'), sale('hazal')], people).slice(0, 2).map(row => row.id), ['hazal', 'levent'])
})

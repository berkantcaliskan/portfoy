import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildNoteSchedule, buildPaymentPeriods, getFinancedAmount, getPrepaymentTotal, groupNotePages, insertInstallmentAbove, liraInWords, parseLira } from '../src/utils/promissoryNotes.ts'

test('3.500.000 TL, kuruş kaybetmeden 36 senede ve 12 sayfaya bölünür', () => {
  const total = parseLira('3.500.000,00')
  assert.equal(total, 350_000_000)
  const notes = buildNoteSchedule(total, 36, '2026-11-30', {})
  assert.equal(notes.reduce((sum, note) => sum + (note.cents ?? 0), 0), total)
  assert.equal(notes[0].amount, '97.222,23')
  assert.equal(notes.at(-1)?.amount, '97.222,22')
  assert.deepEqual(groupNotePages(notes).map(page => page.length), Array(12).fill(3))
  assert.deepEqual(groupNotePages(notes.slice(0, 4)).map(page => page.length), [3, 1])
})

test('Tekil düzenlemeler komşu senetleri değiştirmez ve ay sonu günü geri gelir', () => {
  const notes = buildNoteSchedule(300_000, 4, '2028-01-31', { 3: { amount: '800,50', dueDate: '2028-03-25' } })
  assert.deepEqual(notes.map(note => note.dueDate), ['2028-01-31', '2028-02-29', '2028-03-25', '2028-04-30'])
  assert.deepEqual(notes.map(note => note.cents), [75_000, 75_000, 80_050, 75_000])
  assert.equal(buildNoteSchedule(300_000, 3, '2027-01-31', {})[2].dueDate, '2027-03-31')
})

test('Türk lirası metni tam sayıyı ve kuruşu aynı tutardan üretir', () => {
  assert.equal(liraInWords(parseLira('1.450.000,01')!), 'bir milyon dört yüz elli bin Türk lirası bir kuruş')
  assert.equal(parseLira('70.000'), 7_000_000)
  assert.equal(parseLira('21.75'), 2175)
  assert.equal(parseLira('1,234'), null)
  assert.equal(parseLira('-5'), null)
})

test('Peşinat ve kapora düşüldükten sonra dönemler kalan borca ve aya göre açılır', () => {
  const balance = getFinancedAmount('3.500.000,00', getPrepaymentTotal(['400 bin', '100 bin']))
  assert.equal(balance, 300_000_000)
  const first = buildPaymentPeriods(balance, 36, [{amount:'50 bin', months:'12'}])
  assert.equal(first.periods[1].amount, '100.000,00')
  assert.equal(first.periods[1].months, '24')
  const plan = buildPaymentPeriods(balance, 36, [{amount:'50 bin', months:'12'}, {amount:'80.000', months:'12'}])
  assert.deepEqual(plan.periods.map(({amount,months})=>[amount,months]), [['50 bin','12'],['80.000','12'],['120.000,00','12']])
  assert.equal(plan.amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0), balance)
  assert.equal(plan.balance, 0)
  assert.ok(buildPaymentPeriods(balance, 36, [{amount:'80 bin', months:'37'}]).invalid)
  assert.ok(buildPaymentPeriods(balance, 36, [{amount:'500 bin', months:'12'}]).invalid)
})

test('Birden çok peşinat ve kapora kuruşlarıyla toplanır', () => {
  const prepaid = getPrepaymentTotal(['150,01', '', '49,99', '0,02'])
  assert.equal(prepaid, 20_002)
  assert.equal(getFinancedAmount('1.000', prepaid), 79_998)
  assert.equal(getPrepaymentTotal(['']), 0)
  assert.equal(getFinancedAmount('1.000', getPrepaymentTotal(['150,01', 'bozuk'])), null)
})

test('Aynı tarihe eklenen vadeler numaralanır, eski vadeler ve kuruş toplamı korunur', () => {
  const installments = buildNoteSchedule(101, 3, '2027-01-31', {'2':{amount:'0,34',dueDate:'2027-02-25'}})
  const inserted = insertInstallmentAbove({}, 'extra-a', installments[1])
  const twice = insertInstallmentAbove(inserted, 'extra-b', {id:'extra-a', month:2})
  const result = buildNoteSchedule(101, 3, '2027-01-31', {'2':{amount:'0,34',dueDate:'2027-02-25'}}, {inserted:twice})
  assert.deepEqual(result.map(({id,number,dueDate})=>[id,number,dueDate]), [
    ['1',1,'2027-01-31'], ['extra-b',2,'2027-02-25'], ['extra-a',3,'2027-02-25'],
    ['2',4,'2027-02-25'], ['3',5,'2027-03-31'],
  ])
  assert.deepEqual(result.map(({cents})=>cents), [34,null,null,34,33])
})

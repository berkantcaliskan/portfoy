import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, csvText } from '../src/utils/csvExport.ts'

test('CSV metinleri formül olarak çalıştırılamaz', () => {
  for (const value of ['=SUM(A1)', '+cmd', '-cmd', '@formula', '  =formula', '\tformula']) assert.equal(csvCell(value).startsWith('"\''), true)
})
test('CSV sayısal tutarı korur ve ayraç/tırnakları kaçırır', () => {
  assert.equal(csvCell(-12.5), '-12.5')
  assert.equal(csvCell('a;"b"'), '"a;""b"""')
  assert.equal(csvText([['Türkçe', 100]]), '\uFEFF"Türkçe";100')
})

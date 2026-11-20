import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { containsCredential } from '../scripts/renderer-credential-check.mjs'
test('Document resources remain publishable while changed content and unrelated credentials fail closed',()=>{
  const original=readFileSync(new URL('../src/components/contracts/sales-v1.docx',import.meta.url))
  const file='assets/App-fixture.js'
  const literal=(b:Buffer)=>JSON.stringify('data:application/octet-stream;base64,'+b.toString('base64'))
  const token='EA'+'A'+'x'.repeat(45)
  assert.equal(containsCredential(file,literal(original)),false)
  assert.equal(containsCredential(file,literal(original)+';'+JSON.stringify(token)),true)
  assert.equal(containsCredential(file,literal(Buffer.concat([original,Buffer.from('changed')]))),true)
  assert.equal(containsCredential('assets/another.js',literal(original)),true)
  assert.equal(containsCredential(file,literal(original)+';'+JSON.stringify('sb_'+'secret_'+'x'.repeat(30))),true)
})

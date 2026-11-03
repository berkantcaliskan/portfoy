import {test} from 'node:test'
import assert from 'node:assert/strict'
import {MetaStageQueue} from '../src/services/metaStageQueue.ts'

test('Bir ağ hatası sonraki aşama yazımını bloke etmez',async()=>{
  const q=new MetaStageQueue();let calls=0
  await assert.rejects(q.enqueue('lead',async()=>{calls++;throw Error('isolated timeout')}))
  await q.enqueue('lead',async()=>{calls++})
  await q.wait('lead');assert.equal(calls,2)
})
test('Başarısız aşama düzelmeden gönderim wait hatayı korur',async()=>{
  const q=new MetaStageQueue()
  await assert.rejects(q.enqueue('lead',async()=>{throw Error('failure')}))
  await assert.rejects(q.wait('lead'))
  q.reconcile('lead');await q.wait('lead')
})
test('Aynı müşterinin ardışık işlemleri sırayla kaydedilir',async()=>{
  const q=new MetaStageQueue();const order:string[]=[]
  let release!:()=>void;const hold=new Promise<void>(r=>{release=r})
  const a=q.enqueue('lead',async()=>{order.push('first-start');await hold;order.push('first-end')})
  const b=q.enqueue('lead',async()=>{order.push('second')})
  await new Promise(r=>setImmediate(r));assert.deepEqual(order,['first-start'])
  release();await Promise.all([a,b]);assert.deepEqual(order,['first-start','first-end','second'])
})
test('Başka müşterinin işlemi bekleyen müşteriye takılmaz',async()=>{
  const q=new MetaStageQueue();let release!:()=>void
  const a=q.enqueue('a',()=>new Promise<void>(r=>{release=r}))
  await new Promise(r=>setImmediate(r));let b=false
  await q.enqueue('b',async()=>{b=true});assert.equal(b,true)
  assert.throws(()=>q.reconcile('a'));release();await a
})
test('İkinci işlem başarısı önceki hatayı temizler',async()=>{
  const q=new MetaStageQueue();let second=false
  const first=q.enqueue('lead',async()=>{throw Error('failed')})
  const next=q.enqueue('lead',async()=>{second=true})
  await assert.rejects(first);await next;await q.wait('lead');assert.equal(second,true)
})

import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
const root=new URL('../../',import.meta.url)
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'meta-staging-'))
execFileSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-meta-staging.mjs',root)),folder])
const base=pathToFileURL(folder+path.sep)
const read=p=>fs.readFileSync(new URL(p,base),'utf8')
await db.exec(read('01_BOS_STAGING_KUR.sql'))
assert.equal((await db.query('select security_ready,enabled,auto_sync from meta_settings')).rows[0].security_ready,false)
console.log('GEÇTİ: Boş ortam kurulumu; gönderim ve güvenlik hazır bayrağı kapalı')
await assert.rejects(db.exec(read('01_BOS_STAGING_KUR.sql')))
await db.exec('ROLLBACK')
console.log('GEÇTİ: Mevcut CRM tablolarıyla tekrar kurulum reddedilir')
await assert.rejects(db.exec(read('02_YONETICI_VE_RLS.sql')))
await db.exec('ROLLBACK')
console.log('GEÇTİ: Yer tutucu Auth UUID ile yetki kurulamaz')
const uid='00000000-0000-0000-0000-000000000001'
await db.query('insert into auth.users values($1)',[uid])
await db.exec(read('02_YONETICI_VE_RLS.sql').replaceAll('00000000-0000-0000-0000-000000000000',uid))
assert.deepEqual((await db.query('select enabled,auto_sync,security_ready from meta_settings')).rows[0],{enabled:false,auto_sync:false,security_ready:true})
assert.equal((await db.query('select is_admin from meta_members')).rows[0].is_admin,true)
console.log('GEÇTİ: Geçerli Auth eşlemesi ve RLS kurulumu; canlı ve otomatik gönderim kapalı')
await db.exec('SET ROLE anon')
await assert.rejects(db.query('select * from leads'))
console.log('GEÇTİ: Anonim müşteri erişimi kapalı')
await db.close()
assert.equal(path.dirname(path.resolve(folder)),path.resolve(os.tmpdir()))
assert.ok(path.basename(folder).startsWith('meta-staging-'))
fs.rmSync(folder,{recursive:true})

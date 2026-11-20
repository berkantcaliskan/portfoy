import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE SCHEMA crm_backend;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT current_setting('request.jwt.claims')::jsonb$$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
  CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now(), deleted_at timestamptz, banned_until timestamptz);
  CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,aal text DEFAULT 'aal1',created_at timestamptz DEFAULT now(),not_after timestamptz);
  CREATE TABLE auth.mfa_factors(user_id uuid,status text);
  CREATE TABLE public.app_users(id text PRIMARY KEY, username text,full_name text,department text,role text,company_name text,must_change_password boolean DEFAULT false);
  CREATE TABLE public.crm_identities(app_user_id text,auth_user_id uuid,active boolean DEFAULT true);
`)
const members = {}
for (const [name,role,company] of [
  ['berkant','ADMIN','Demirtürk İnşaat'],['murat','ADMIN','Demirtürk İnşaat'],
  ['technical','ADMIN','Demirtürk İnşaat'],['rep','MEMBER','Demirtürk İnşaat'],['outside','MEMBER','Başka şirket'],
]) {
  const id=randomUUID(), sid=randomUUID()
  members[name]={id,sid}
  await db.query('INSERT INTO auth.users (id,email) VALUES ($1,$2)',[id,name+'@example.test'])
  await db.query('INSERT INTO auth.sessions(id,user_id) VALUES ($1,$2)',[sid,id])
  await db.query('INSERT INTO app_users(id,username,full_name,department,role,company_name) VALUES($1,$1,$1,$2,$3,$4)',[name,'Satış',role,company])
  await db.query('INSERT INTO crm_identities(app_user_id,auth_user_id) VALUES ($1,$2)',[name,id])
}
await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261120151517_crm_admin_account_switch.sql',import.meta.url),'utf8'))
const actor=members.berkant
async function directory({id,sid}) {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid})])
  return (await db.query('SELECT public.crm_account_switch_directory() AS rows')).rows[0].rows
}
await db.exec('SET ROLE authenticated')
assert.deepEqual((await directory(actor)).map(x=>x.id),['murat','rep'])
assert.deepEqual((await directory(members.murat)).map(x=>x.id),['berkant','rep'])
for (const u of [members.rep,members.outside,members.technical,{...actor,sid:randomUUID()}])
  await assert.rejects(directory(u), /crm_forbidden/)
const prepare=(u,name,request=randomUUID())=>db.query('SELECT public.crm_begin_account_switch($1,$2,$3,$4) AS target',[u.id,u.sid,name,request])
await assert.rejects(prepare(actor,'rep'),/permission denied/)
await db.exec('RESET ROLE; SET ROLE service_role')
for (const name of ['outside','technical','berkant','unknown']) await assert.rejects(prepare(actor,name),/crm_target_unavailable/)
await assert.rejects(prepare(members.rep,'murat'),/crm_forbidden/)
const req=randomUUID(), sid=randomUUID()
assert.equal((await prepare(actor,'rep',req)).rows[0].target.authId,members.rep.id)
await assert.rejects(prepare(actor,'rep',req),/duplicate key/)
await db.exec('RESET ROLE')
await db.query('INSERT INTO auth.sessions(id,user_id) VALUES ($1,$2)',[sid,members.rep.id])
const finish=()=>db.query('SELECT public.crm_finish_account_switch($1,$2,$3)',[req,members.rep.id,sid])
await db.query("UPDATE crm_identities SET active=false WHERE app_user_id='berkant'")
await assert.rejects(finish(),/crm_forbidden/)
await db.query("UPDATE crm_identities SET active=true WHERE app_user_id='berkant'")
await finish()
await assert.rejects(finish(),/crm_forbidden/)
assert.equal((await db.query('SELECT count(*)::int AS n FROM auth.sessions WHERE not_after IS NOT NULL')).rows[0].n,1)
assert.equal((await db.query('SELECT target_session FROM crm_backend.account_switch_audit WHERE request_id=$1',[req])).rows[0].target_session,sid)
await db.query("UPDATE app_users SET must_change_password=true WHERE id='rep'")
assert.equal((await directory(actor)).find(x=>x.id==='rep').available,false)
await assert.rejects(prepare(actor,'rep'),/crm_target_unavailable/)
await db.exec("UPDATE app_users SET must_change_password=false WHERE id='rep'")
await db.query("INSERT INTO auth.mfa_factors VALUES($1,'verified')",[members.rep.id])
await assert.rejects(prepare(actor,'rep'),/crm_target_unavailable/)
await db.exec("UPDATE app_users SET role='MEMBER' WHERE id='berkant'")
await assert.rejects(directory(actor),/crm_forbidden/)
await db.close()
console.log('Account switch: admin pins, tenant, MFA, SQL grants, audit, session binding, replay and revocation passed.')

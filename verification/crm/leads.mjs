import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const read = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
const [admin, relations, marketing, outsider, firstLogin, sales] = [1, 2, 3, 4, 5, 6].map(
  number => '10000000-0000-0000-0000-00000000000' + number,
)
const request = number => '20000000-0000-0000-0000-00000000000' + number
const schema = read('docs/supabase_schema.sql').split('-- 4. PROJELER')[0]
const migration = read('supabase/migrations/20261116073823_crm_department_lead_work.sql')

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE SCHEMA crm_backend;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  ${schema}
  ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
`)
await db.exec(read('supabase/migrations/202610310001_meta_pipeline.sql'))
await db.exec(`
  INSERT INTO auth.users VALUES ('${admin}'), ('${relations}'), ('${marketing}'), ('${outsider}'), ('${firstLogin}'), ('${sales}');
  INSERT INTO public.app_users(id, full_name, username, password, company_name, department, role, scope, must_change_password) VALUES
    ('admin', 'Admin', 'admin', 'unused', 'Alpha', 'Yönetim', 'ADMIN', 'ALL', false),
    ('relations', 'Danışman', 'relations', 'unused', 'Alpha', 'Müşteri İlişkileri', 'MEMBER', 'DEPARTMENT', false),
    ('marketing', 'Pazarlama', 'marketing', 'unused', 'Alpha', 'Pazarlama', 'MEMBER', 'DEPARTMENT', false),
    ('outsider', 'Dış ekip', 'outsider', 'unused', 'Beta', 'Müşteri İlişkileri', 'MEMBER', 'DEPARTMENT', false),
    ('initial', 'İlk giriş', 'initial', 'unused', 'Alpha', 'Müşteri İlişkileri', 'MEMBER', 'DEPARTMENT', true),
    ('sales', 'Satış Danışmanı', 'sales', 'unused', 'Alpha', 'Satış', 'MEMBER', 'ASSIGNED_ONLY', false);
  INSERT INTO public.meta_members(auth_user_id, app_user_id, is_admin) VALUES ('${admin}', 'admin', true);
  INSERT INTO public.leads(id, full_name, phone, source) VALUES
    ('meta', 'Meta form', '', 'META_ADS'), ('web', 'Web form', '', 'WEBSITE');
  INSERT INTO public.lead_activities(id, lead_id, type, content, author) VALUES
    ('meta-note', 'meta', 'NOTE', 'Not A', 'Webhook'), ('web-note', 'web', 'NOTE', 'Not B', 'Webhook');
  CREATE POLICY old_lead_read ON public.leads FOR SELECT TO authenticated USING (true);
  CREATE POLICY old_activity_read ON public.lead_activities FOR SELECT TO authenticated USING (true);
`)
await db.exec(read('supabase/migrations/202611040001_crm_identity_foundation.sql'))
const staffMigration = read('supabase/migrations/202611080003_crm_staff_accounts.sql')
const profileFunction = staffMigration.slice(
  staffMigration.indexOf('CREATE OR REPLACE FUNCTION public.crm_get_my_profile()'),
  staffMigration.indexOf('CREATE OR REPLACE FUNCTION crm_backend.can_access'),
)
await db.exec(profileFunction)
await db.exec(`
  INSERT INTO public.crm_identities(auth_user_id, app_user_id) VALUES
    ('${relations}', 'relations'), ('${marketing}', 'marketing'), ('${outsider}', 'outsider'), ('${firstLogin}', 'initial'), ('${sales}', 'sales');
`)
await db.exec(migration)
await db.exec(migration)

async function asStaff(id, work) {
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${id}'`)
  try { return await work() } finally {
    await db.exec('RESET ROLE; RESET request.jwt.claim.sub')
  }
}
const ids = async table => (await db.query(`SELECT id FROM public.${table} ORDER BY id`)).rows.map(row => row.id)
const write = async (number, lead, expected, change) => (
  await db.query(
    'SELECT public.crm_update_lead_work($1::uuid,$2,$3::timestamptz,$4::jsonb) AS lead',
    [request(number), lead, expected, JSON.stringify(change)],
  )
).rows[0].lead

await asStaff(marketing, async () => {
  assert.deepEqual(await ids('leads'), ['meta'])
  assert.deepEqual(await ids('lead_activities'), ['meta-note'])
  await assert.rejects(write(1, 'meta', new Date().toISOString(), { notes: 'denied' }), /crm_lead_forbidden/)
})
for (const blocked of [outsider, firstLogin, sales]) {
  await asStaff(blocked, async () => assert.deepEqual(await ids('leads'), []))
}
const handover = await asStaff(relations, async () => {
  assert.deepEqual(await ids('leads'), ['meta', 'web'])
  const initial = (await db.query("SELECT updated_at::text AS stamp FROM public.leads WHERE id='meta'")).rows[0].stamp
  const note = await write(1, 'meta', initial, { notes: 'Arandı' })
  assert.equal(note.notes, 'Arandı')
  await assert.rejects(write(2, 'meta', initial, { notes: 'stale' }), /crm_lead_conflict/)
  const call = await write(2, 'meta', note.updated_at, { callStatus: 'CALLED' })
  assert.equal(call.call_status, 'CALLED')
  const assigned = await write(3, 'meta', call.updated_at, { assignedToUserId: 'relations' })
  await assert.rejects(write(4, 'meta', assigned.updated_at, { assignedToUserId: 'outsider' }), /crm_invalid_consultant/)
  const stage = await write(4, 'meta', assigned.updated_at, { stage: 'QUALIFIED', isQualified: true })
  assert.equal(stage.assigned_to_user_name, 'Danışman')
  assert.equal(stage.stage, 'QUALIFIED')
  assert.equal(stage.meta_revision, 1)
  assert.equal(stage.stage_history[0].changedByUserId, 'relations')
  const addedNote = await db.query('SELECT public.crm_add_lead_note($1,$2,$3) AS id', [request(5), 'meta', 'Takip notu'])
  assert.equal(addedNote.rows[0].id, 'crm-note-' + request(5))
  return write(6, 'meta', stage.updated_at, { salesTarget: 'sales', salesNote: 'Takip edilecek' })
})
await asStaff(sales, async () => assert.deepEqual(await ids('leads'), ['meta']))
await asStaff(relations, async () => {
  const revoked = await write(7, 'meta', handover.updated_at, { salesTarget: null })
  await assert.rejects(write(8, 'meta', revoked.updated_at, { budget: -1 }), /crm_invalid_lead_change/)
  const contact = await write(8, 'meta', revoked.updated_at, { fullName: 'Düzeltilmiş isim', email: null, budget: 0 })
  assert.equal(contact.full_name, 'Düzeltilmiş isim')
  assert.equal(contact.email, null)
  assert.equal(contact.budget, 0)
  assert.equal(contact.meta_revision, 1)
})
await asStaff(sales, async () => assert.deepEqual(await ids('leads'), []))
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.lead_activities WHERE id LIKE 'crm-work-%'")).rows[0].n, 7)
assert.deepEqual(
  (await db.query("SELECT content, author FROM public.lead_activities WHERE id LIKE 'crm-note-%'")).rows,
  [{ content: 'Takip notu', author: 'Danışman' }],
)
assert.equal((await db.query('SELECT count(*)::int AS n FROM public.meta_outbox')).rows[0].n, 0)
console.log('CRM departman SQL: erişim, veri yalıtımı, kalıcı işlemler, çakışma ve Meta gönderim ayrımı doğrulandı.')
await db.close()

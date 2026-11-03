import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createWebhook } from '../_shared/meta-core.ts'
const env = (name: string) => Deno.env.get(name) || ''
Deno.serve(createWebhook({
  verifyToken: env('META_VERIFY_TOKEN'), appSecret: env('META_APP_SECRET'),
  pageToken: env('META_PAGE_ACCESS_TOKEN'), version: env('META_GRAPH_VERSION'), pageId: env('META_PAGE_ID'),
  ingest: async intake => {
    if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Sunucu ayarları eksik.')
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const { error } = await db.rpc('meta_ingest_lead', { p: intake })
    if (error) throw new Error('Başvuru işlemi geri alındı.')
  },
}))

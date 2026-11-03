import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://unconfigured.invalid'
const DEFAULT_KEY = 'unconfigured-public-key'

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_URL
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export function isSupabaseConfigured(): boolean {
  return import.meta.env.VITE_ENABLE_SUPABASE_SYNC === 'true' && Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

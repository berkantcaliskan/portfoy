import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://unjfqfservizfmbgofhq.supabase.co'
const DEFAULT_KEY = 'sb_publishable__99mhA3MbU9nnH8bn9S9nw_X7gWNlAO'

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
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

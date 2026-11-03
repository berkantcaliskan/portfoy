import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createCapiHandler } from '../_shared/meta-capi-handler.ts'

Deno.serve(createCapiHandler({
  env: name => Deno.env.get(name) || '',
  createClient,
}))

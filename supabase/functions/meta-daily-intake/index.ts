import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createDailyIntakeHandler } from '../_shared/meta-daily-intake.ts'
Deno.serve(createDailyIntakeHandler({ env: name => Deno.env.get(name) || '', createClient }))

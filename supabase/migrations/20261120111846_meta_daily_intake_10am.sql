BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE IF NOT EXISTS crm_backend.meta_intake_jobs (
 run_date date PRIMARY KEY, range_from timestamptz NOT NULL, range_to timestamptz NOT NULL,
 state jsonb NOT NULL DEFAULT '{}', complete boolean NOT NULL DEFAULT false,
 lease uuid, lease_until timestamptz, next_at timestamptz NOT NULL DEFAULT now(),
 pages bigint NOT NULL DEFAULT 0, processed bigint NOT NULL DEFAULT 0, failures integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), last_error text,
 CHECK(range_from<=range_to)
);
ALTER TABLE crm_backend.meta_intake_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.meta_intake_jobs FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='portfoy_meta_intake_cron') THEN
  PERFORM vault.create_secret(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'portfoy_meta_intake_cron','Portfoy daily intake only');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION crm_backend.meta_intake_tick(p_start boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,crm_backend,pg_temp AS $$
DECLARE cutoff timestamptz; latest timestamptz; secret text;
BEGIN
 IF p_start THEN
  cutoff:=((now() AT TIME ZONE 'Europe/Istanbul')::date + time '10:00') AT TIME ZONE 'Europe/Istanbul';
  IF now()<cutoff THEN RETURN; END IF;
  SELECT max(submitted_at) INTO latest FROM public.meta_lead_events WHERE submitted_at<=cutoff;
  INSERT INTO crm_backend.meta_intake_jobs(run_date,range_from,range_to)
   VALUES((cutoff AT TIME ZONE 'Europe/Istanbul')::date,
    greatest(coalesce(latest-interval '1 minute',cutoff-interval '1 day'),timestamptz '2026-11-18 00:00:00+03'),cutoff)
   ON CONFLICT DO NOTHING;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM crm_backend.meta_intake_jobs WHERE NOT complete AND next_at<=now() AND (lease_until IS NULL OR lease_until<now())) THEN RETURN; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='portfoy_meta_intake_cron';
 PERFORM net.http_post(url:='https://tuudlltasharcuaigdar.supabase.co/functions/v1/meta-daily-intake',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-token',secret),body:='{}'::jsonb,timeout_milliseconds:=120000);
END $$;
REVOKE ALL ON FUNCTION crm_backend.meta_intake_tick(boolean) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.meta_daily_intake_claim(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,crm_backend,pg_temp AS $$
DECLARE secret text; job crm_backend.meta_intake_jobs;
BEGIN
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='portfoy_meta_intake_cron';
 IF p_token IS NULL OR length(p_token)<>64 OR p_token IS DISTINCT FROM secret THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO job FROM crm_backend.meta_intake_jobs WHERE NOT complete AND next_at<=now()
  AND (lease_until IS NULL OR lease_until<now()) ORDER BY run_date FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE crm_backend.meta_intake_jobs SET lease=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
  WHERE run_date=job.run_date RETURNING * INTO job;
 RETURN jsonb_build_object('date',job.run_date,'from',job.range_from,'to',job.range_to,'lease',job.lease,'state',job.state);
END $$;
CREATE OR REPLACE FUNCTION public.meta_daily_intake_finish(p_date date,p_lease uuid,p_state jsonb,p_complete boolean,p_pages integer,p_processed integer,p_error boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,crm_backend,pg_temp AS $$
BEGIN
 UPDATE crm_backend.meta_intake_jobs SET
  state=CASE WHEN p_error THEN state ELSE p_state END,complete=CASE WHEN p_error THEN false ELSE p_complete END,
  pages=pages+CASE WHEN p_error THEN 0 ELSE greatest(p_pages,0) END,
  processed=processed+CASE WHEN p_error THEN 0 ELSE greatest(p_processed,0) END,
  failures=failures+CASE WHEN p_error THEN 1 ELSE 0 END,last_error=CASE WHEN p_error THEN 'intake_failed' ELSE NULL END,
  lease=NULL,lease_until=NULL,next_at=now()+CASE WHEN p_error THEN interval '5 minutes' ELSE interval '0 seconds' END,updated_at=now()
 WHERE run_date=p_date AND lease=p_lease;
 IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.meta_daily_intake_claim(text),public.meta_daily_intake_finish(date,uuid,jsonb,boolean,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_daily_intake_claim(text),public.meta_daily_intake_finish(date,uuid,jsonb,boolean,integer,integer,boolean) TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='portfoy-meta-daily-10-istanbul') THEN
  PERFORM cron.schedule('portfoy-meta-daily-10-istanbul','0 7 * * *','SELECT crm_backend.meta_intake_tick(true);');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='portfoy-meta-intake-resume') THEN
  PERFORM cron.schedule('portfoy-meta-intake-resume','* * * * *','SELECT crm_backend.meta_intake_tick(false);');
 END IF;
END $$;
COMMIT;

-- Önce staging ortamında çalıştırın. Mevcut CRM erişim politikalarını değiştirmez.
BEGIN;
CREATE TABLE IF NOT EXISTS public.meta_members (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  app_user_id text UNIQUE REFERENCES public.app_users(id),
  can_send boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.meta_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  enabled boolean NOT NULL DEFAULT false,
  auto_sync boolean NOT NULL DEFAULT false,
  security_ready boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  CHECK (NOT enabled OR (security_ready AND enabled_at IS NOT NULL))
);
INSERT INTO public.meta_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
UPDATE public.meta_settings SET auto_sync=false WHERE id=true;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.meta_settings'::regclass AND conname='meta_settings_manual_only') THEN
    ALTER TABLE public.meta_settings ADD CONSTRAINT meta_settings_manual_only CHECK (NOT auto_sync);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.meta_lead_events (
  leadgen_id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES public.leads(id),
  form_id text, ad_id text, campaign_id text,
  submitted_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_fields jsonb NOT NULL,
  matching_state text NOT NULL CHECK(matching_state IN ('new','matched','ambiguous','missing_phone'))
);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_lead_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_changed_at timestamptz;
CREATE TABLE IF NOT EXISTS public.meta_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL REFERENCES public.leads(id),
  revision bigint NOT NULL,
  event_name text NOT NULL,
  test_mode boolean NOT NULL DEFAULT false,
  requested_by uuid REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  payload jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','retry','rejected')),
  attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid, lease_until timestamptz,
  last_attempt_at timestamptz, sent_at timestamptz,
  events_received integer, fbtrace_id text, error_code text,
  UNIQUE(lead_id, revision, event_name, test_mode)
);
CREATE TABLE IF NOT EXISTS public.meta_attempts (
  event_id uuid NOT NULL REFERENCES public.meta_outbox(id),
  attempt integer NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL, http_status integer, meta_code integer, meta_subcode integer,
  events_received integer, fbtrace_id text,
  PRIMARY KEY(event_id,attempt)
);
CREATE TABLE IF NOT EXISTS public.meta_stage_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id text NOT NULL REFERENCES public.leads(id),
  revision bigint NOT NULL, actor uuid, changed_at timestamptz NOT NULL DEFAULT now(),
  old_stage text, new_stage text, qualified boolean,
  UNIQUE(lead_id,revision)
);
CREATE INDEX IF NOT EXISTS meta_lead_events_customer_idx ON public.meta_lead_events(lead_id,submitted_at DESC,leadgen_id DESC);
CREATE INDEX IF NOT EXISTS meta_outbox_pending_idx ON public.meta_outbox(state,next_attempt_at);
CREATE INDEX IF NOT EXISTS meta_attempts_started_idx ON public.meta_attempts(started_at);
ALTER TABLE public.meta_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_stage_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_members,public.meta_settings,public.meta_lead_events,public.meta_outbox,public.meta_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.meta_members,public.meta_settings,public.meta_lead_events,public.meta_outbox,public.meta_attempts TO service_role;
REVOKE ALL ON public.meta_stage_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.meta_stage_audit TO service_role;

CREATE OR REPLACE FUNCTION public.meta_normalize_phone(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE n text := regexp_replace(coalesce(p,''),'[^0-9]','','g');
BEGIN
  IF n LIKE '00%' THEN n:=substr(n,3); END IF;
  IF n ~ '^05[0-9]{9}$' THEN n:='90'||substr(n,2); END IF;
  IF n ~ '^5[0-9]{9}$' THEN n:='90'||n; END IF;
  RETURN CASE WHEN n ~ '^905[0-9]{9}$' THEN n ELSE NULL END;
END $$;
CREATE INDEX IF NOT EXISTS leads_meta_phone_idx ON public.leads(public.meta_normalize_phone(phone));

CREATE OR REPLACE FUNCTION public.meta_ingest_lead(p jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lid text; n text; candidates integer; inquiry jsonb; match_state text;
BEGIN
  IF coalesce(p->>'leadgenId','') !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'invalid_lead_id'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('meta-event:'||(p->>'leadgenId'),0));
  SELECT lead_id INTO lid FROM meta_lead_events WHERE leadgen_id=p->>'leadgenId';
  IF FOUND THEN RETURN lid; END IF;
  n:=meta_normalize_phone(p->>'phone');
  IF n IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('meta-phone:'||n,0));
    SELECT count(*),min(id) INTO candidates,lid FROM leads WHERE meta_normalize_phone(phone)=n;
    IF candidates <> 1 THEN lid:=NULL; END IF;
  ELSE candidates:=0; END IF;
  match_state:=CASE WHEN n IS NULL THEN 'missing_phone' WHEN candidates>1 THEN 'ambiguous' WHEN candidates=1 THEN 'matched' ELSE 'new' END;
  inquiry:=jsonb_strip_nulls(jsonb_build_object(
    'id','meta-inq-'||(p->>'leadgenId'),'metaLeadgenId',p->>'leadgenId',
    'metaFormId',p->>'formId','metaAdId',p->>'adId','metaCampaignId',p->>'campaignId',
    'formName',p->>'formName','campaignName',p->>'campaignName','source','META_ADS',
    'channel','Meta Lead Ads','createdAt',p->>'createdAt','metaAnswers',p->'answers',
    'preferredHousingType',p->>'housingType','budget',p->'budget'));
  IF lid IS NULL THEN
    lid:='lead-meta-'||(p->>'leadgenId');
    INSERT INTO leads(id,full_name,phone,whatsapp_phone,email,source,form_name,channel,stage,owner,tags,
      inquiries,meta_answers,meta_lead_id,preferred_housing_type,budget,created_at,updated_at)
    VALUES(lid,p->>'fullName',coalesce(n,''),coalesce(n,''),p->>'email','META_ADS',p->>'formName','Meta Lead Ads','NEW','Atanmamış','["Meta Reklam"]',
      jsonb_build_array(inquiry),p->'answers',p->>'leadgenId',p->>'housingType',(p->>'budget')::numeric,(p->>'createdAt')::timestamptz,now());
  ELSE
    PERFORM 1 FROM leads WHERE id=lid FOR UPDATE;
    -- Eski CSV inquiry'si ancak Graph'tan doğrulanan tam telefonla eşleşen aynı müşteride tekrar sayılmaz.
    UPDATE leads SET inquiries=CASE
      WHEN coalesce(inquiries,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('metaLeadgenId',p->>'leadgenId'))
      THEN inquiries ELSE jsonb_build_array(inquiry)||coalesce(inquiries,'[]'::jsonb) END,
      updated_at=now() WHERE id=lid;
  END IF;
  INSERT INTO meta_lead_events(leadgen_id,lead_id,form_id,ad_id,campaign_id,submitted_at,raw_fields,matching_state)
    VALUES(p->>'leadgenId',lid,p->>'formId',p->>'adId',p->>'campaignId',(p->>'createdAt')::timestamptz,p->'fields',match_state);
  INSERT INTO lead_activities(id,lead_id,type,content,author)
    VALUES('meta-act-'||(p->>'leadgenId'),lid,'NOTE','Meta form başvurusu kaydedildi.','Meta Webhook');
  RETURN lid;
END $$;

CREATE OR REPLACE FUNCTION public.meta_event_for_stage(s text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE s
  WHEN 'CONTACTED' THEN 'Contact' WHEN 'QUALIFIED' THEN 'QualifiedLead'
  WHEN 'LOST' THEN 'DisqualifiedLead' WHEN 'NO_INTENT' THEN 'DisqualifiedLead'
  WHEN 'APPOINTMENT' THEN 'Schedule' ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public.meta_can_read_lead(p_user uuid,p_lead text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM meta_members m LEFT JOIN app_users u ON u.id=m.app_user_id
    JOIN leads l ON l.id=p_lead WHERE m.auth_user_id=p_user AND (
      m.is_admin OR u.role='ADMIN' OR u.scope='ALL' OR u.department='Yönetim'
      OR l.assigned_to_user_id=u.id OR (u.scope='DEPARTMENT' AND u.department='Müşteri İlişkileri')
      OR (u.scope='DEPARTMENT' AND u.department='Pazarlama' AND l.source='META_ADS')))
$$;
REVOKE ALL ON FUNCTION public.meta_can_read_lead(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_can_read_lead(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_enqueue(p_user uuid,p_lead text,p_test boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l leads; settings meta_settings; eid uuid; ename text; verified_id text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND (can_send OR is_admin)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO settings FROM meta_settings WHERE id=true;
  IF NOT settings.security_ready OR (NOT p_test AND NOT settings.enabled) THEN RAISE EXCEPTION 'integration_disabled'; END IF;
  IF p_test AND NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND is_admin) THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO l FROM leads WHERE id=p_lead FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF NOT meta_can_read_lead(p_user,p_lead) THEN RAISE EXCEPTION 'lead_forbidden'; END IF;
  IF NOT p_test AND (l.meta_revision=0 OR l.meta_changed_at < settings.enabled_at) THEN RAISE EXCEPTION 'historical_backfill_disabled'; END IF;
  IF l.meta_changed_at IS NULL THEN RAISE EXCEPTION 'stage_change_required'; END IF;
  ename:=meta_event_for_stage(l.stage);
  IF ename IS NULL OR (ename='QualifiedLead' AND NOT l.is_qualified) THEN RAISE EXCEPTION 'ineligible_stage'; END IF;
  SELECT leadgen_id INTO verified_id FROM meta_lead_events WHERE lead_id=l.id
    ORDER BY submitted_at DESC,leadgen_id DESC LIMIT 1;
  IF verified_id IS NULL THEN RAISE EXCEPTION 'verified_meta_id_required'; END IF;
  -- Kuyruk kaydı iş kararıyla atomiktir. Teslim hız sınırı müşterinin aşama kaydını geri alamaz.
  INSERT INTO meta_outbox(lead_id,revision,event_name,test_mode,requested_by,occurred_at,snapshot)
    VALUES(l.id,l.meta_revision,ename,p_test,p_user,l.meta_changed_at,
      jsonb_build_object('id',l.id,'stage',l.stage,'is_qualified',l.is_qualified,'phone',l.phone,
        'email',l.email,'full_name',l.full_name,'meta_lead_id',verified_id))
    ON CONFLICT(lead_id,revision,event_name,test_mode) DO NOTHING RETURNING id INTO eid;
  IF eid IS NULL THEN SELECT id INTO eid FROM meta_outbox WHERE lead_id=l.id AND revision=l.meta_revision AND event_name=ename AND test_mode=p_test; END IF;
  RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.meta_capture_stage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage OR NEW.is_qualified IS DISTINCT FROM OLD.is_qualified THEN
    NEW.meta_revision:=OLD.meta_revision+1; NEW.meta_changed_at:=now();
    INSERT INTO meta_stage_audit(lead_id,revision,actor,old_stage,new_stage,qualified)
      VALUES(NEW.id,NEW.meta_revision,auth.uid(),OLD.stage,NEW.stage,NEW.is_qualified);
  ELSE
    NEW.meta_revision:=OLD.meta_revision; NEW.meta_changed_at:=OLD.meta_changed_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS meta_capture_stage ON public.leads;
CREATE TRIGGER meta_capture_stage BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.meta_capture_stage();

-- Demo: aşama değişikliği asla Meta outbox kaydı oluşturmaz.
DROP TRIGGER IF EXISTS meta_auto_enqueue ON public.leads;
DROP FUNCTION IF EXISTS public.meta_auto_enqueue();

DROP FUNCTION IF EXISTS public.meta_claim(uuid);
CREATE OR REPLACE FUNCTION public.meta_claim(p_id uuid DEFAULT NULL,p_test_only boolean DEFAULT false) RETURNS SETOF public.meta_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Arka plan toplu işleyici kapalıdır. Yalnızca açıkça seçilmiş olay claim edilebilir.
  IF p_id IS NULL THEN RETURN; END IF;
  UPDATE meta_outbox SET state='rejected',error_code='ATTEMPTS_EXHAUSTED',lease_id=NULL,lease_until=NULL
    WHERE state='processing' AND lease_until<now() AND attempt>=5;
  -- DB kilidi birden fazla worker'ın aynı hız penceresini aşmasını önler.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('meta-delivery-rate',0)) THEN RETURN; END IF;
  IF (SELECT count(*) FROM meta_attempts WHERE started_at>now()-interval '1 minute')>=30 THEN RETURN; END IF;
  RETURN QUERY WITH claimed AS (
  UPDATE meta_outbox SET state='processing',attempt=attempt+1,last_attempt_at=now(),lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  WHERE id IN (SELECT id FROM meta_outbox
    WHERE (p_id IS NULL OR id=p_id) AND (NOT p_test_only OR test_mode) AND attempt<5
      AND ((state IN ('pending','retry') AND next_attempt_at<=now()) OR (state='processing' AND lease_until<now()))
    ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING *), audit AS (
    INSERT INTO meta_attempts(event_id,attempt,started_at,state)
    SELECT id,attempt,last_attempt_at,'processing' FROM claimed RETURNING event_id
  ) SELECT claimed.* FROM claimed;
END
$$;

CREATE OR REPLACE FUNCTION public.meta_finish(p_id uuid,p_lease uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item meta_outbox; next_state text:=p_result->>'state';
BEGIN
  SELECT * INTO item FROM meta_outbox WHERE id=p_id AND lease_id=p_lease AND state='processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
  IF next_state NOT IN ('sent','retry','rejected') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  INSERT INTO meta_attempts(event_id,attempt,started_at,state,http_status,meta_code,meta_subcode,events_received,fbtrace_id)
    VALUES(item.id,item.attempt,item.last_attempt_at,next_state,(p_result->>'httpStatus')::integer,
      (p_result->>'code')::integer,(p_result->>'subcode')::integer,(p_result->>'received')::integer,p_result->>'trace')
    ON CONFLICT(event_id,attempt) DO UPDATE SET finished_at=now(),state=excluded.state,http_status=excluded.http_status,
      meta_code=excluded.meta_code,meta_subcode=excluded.meta_subcode,events_received=excluded.events_received,fbtrace_id=excluded.fbtrace_id;
  UPDATE meta_outbox SET state=next_state,events_received=(p_result->>'received')::integer,fbtrace_id=p_result->>'trace',
    error_code=p_result->>'errorCode',sent_at=CASE WHEN next_state='sent' THEN now() ELSE NULL END,
    next_attempt_at=now()+make_interval(secs=>coalesce((p_result->>'retrySeconds')::integer,0)),lease_until=NULL,lease_id=NULL WHERE id=p_id;
END $$;

-- SECURITY DEFINER fonksiyonları varsayılan olarak PUBLIC'a açıktır; tüm RPC'ler yalnızca service_role içindir.
REVOKE ALL ON FUNCTION public.meta_ingest_lead(jsonb),public.meta_enqueue(uuid,text,boolean),public.meta_claim(uuid,boolean),public.meta_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ingest_lead(jsonb),public.meta_enqueue(uuid,text,boolean),public.meta_claim(uuid,boolean),public.meta_finish(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_set_stage(p_user uuid,p_lead text,p_revision bigint,p_stage text,p_qualified boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l leads;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND (can_send OR is_admin))
    OR NOT meta_can_read_lead(p_user,p_lead) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM meta_settings WHERE security_ready) THEN RAISE EXCEPTION 'security_not_ready'; END IF;
  IF p_stage NOT IN ('NEW','CONTACTED','UNDECIDED','NO_INTENT','QUALIFIED','APPOINTMENT','PRESENTATION','OFFER','WON','LOST')
    OR (p_stage='QUALIFIED' AND NOT p_qualified) OR (p_stage IN ('LOST','NO_INTENT') AND p_qualified) THEN RAISE EXCEPTION 'invalid_stage'; END IF;
  -- İşlemdeki aktör yalnızca doğrulanmış sunucu kimliğinden atanır; frontend changedBy alanına güvenilmez.
  PERFORM set_config('request.jwt.claim.sub',p_user::text,true);
  UPDATE leads SET stage=p_stage,is_qualified=p_qualified,updated_at=now()
    WHERE id=p_lead AND meta_revision=p_revision RETURNING * INTO l;
  IF NOT FOUND THEN RAISE EXCEPTION 'stage_revision_conflict'; END IF;
  RETURN to_jsonb(l);
END $$;
REVOKE ALL ON FUNCTION public.meta_set_stage(uuid,text,bigint,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_set_stage(uuid,text,bigint,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_enqueue_checked(p_user uuid,p_lead text,p_test boolean,p_revision bigint,p_event text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l leads;
BEGIN
  SELECT * INTO l FROM leads WHERE id=p_lead FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR p_event IS NULL OR l.meta_revision<>p_revision
    OR meta_event_for_stage(l.stage) IS DISTINCT FROM p_event THEN RAISE EXCEPTION 'stale_stage'; END IF;
  RETURN meta_enqueue(p_user,p_lead,p_test);
END $$;
REVOKE ALL ON FUNCTION public.meta_enqueue_checked(uuid,text,boolean,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_enqueue_checked(uuid,text,boolean,bigint,text) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_request_retry(p_user uuid,p_event uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e meta_outbox; admin boolean;
BEGIN
  SELECT is_admin INTO admin FROM meta_members WHERE auth_user_id=p_user AND (can_send OR is_admin);
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO e FROM meta_outbox WHERE id=p_event FOR UPDATE;
  IF NOT FOUND OR NOT meta_can_read_lead(p_user,e.lead_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF e.state IN ('sent','pending','processing') THEN RETURN; END IF;
  IF e.attempt>=5 OR e.occurred_at<now()-interval '7 days' THEN RAISE EXCEPTION 'retry_limit_or_window'; END IF;
  IF e.state='rejected' AND NOT admin THEN RAISE EXCEPTION 'admin_required_for_rejected'; END IF;
  UPDATE meta_outbox SET state='pending',next_attempt_at=CASE WHEN e.state='retry' THEN greatest(now(),next_attempt_at) ELSE now() END
    WHERE id=p_event;
END $$;
REVOKE ALL ON FUNCTION public.meta_request_retry(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_request_retry(uuid,uuid) TO service_role;
COMMIT;

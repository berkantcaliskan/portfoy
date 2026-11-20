BEGIN;

CREATE TABLE IF NOT EXISTS crm_backend.meta_distribution_state(
 company_name text PRIMARY KEY,
 turn bigint NOT NULL DEFAULT 0 CHECK(turn>=0),
 last_assigned_user_id text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_backend.meta_distribution_turns(
 company_name text NOT NULL,
 app_user_id text NOT NULL,
 last_turn bigint NOT NULL CHECK(last_turn>=0),
 PRIMARY KEY(company_name,app_user_id)
);
CREATE TABLE IF NOT EXISTS crm_backend.lead_archives(
 lead_id text PRIMARY KEY REFERENCES public.leads(id),
 company_name text NOT NULL,
 archived_by text NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_backend.lead_archive_requests(
 actor uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 command jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor,request_id)
);
ALTER TABLE crm_backend.meta_distribution_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.meta_distribution_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.lead_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.lead_archive_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.meta_distribution_state,crm_backend.meta_distribution_turns,
 crm_backend.lead_archives,crm_backend.lead_archive_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_backend.crm_can_access_lead(p_id text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
  JOIN crm_backend.lead_workspace w ON w.company_name=u.company_name JOIN public.leads l ON l.id=p_id
  WHERE i.auth_user_id=auth.uid() AND i.active AND NOT u.must_change_password
   AND NOT EXISTS(SELECT 1 FROM crm_backend.lead_archives a WHERE a.lead_id=l.id)
   AND CASE
    WHEN u.role='ADMIN' THEN true
    WHEN u.department='Müşteri İlişkileri' THEN l.assigned_to_user_id=u.id
    WHEN u.department='Pazarlama' THEN NOT p_write AND (
      l.source IN ('META_ADS','FACEBOOK','INSTAGRAM') OR EXISTS(SELECT 1 FROM public.meta_lead_events e WHERE e.lead_id=l.id))
    WHEN u.department='Yönetim' THEN true
    WHEN (u.department='Satış' OR coalesce(u.departments,'[]'::jsonb) ? 'Satış') THEN NOT p_write AND EXISTS(
      SELECT 1 FROM (SELECT item FROM jsonb_array_elements(coalesce(l.assignment_history,'[]'::jsonb)) WITH ORDINALITY a(item,position)
       WHERE jsonb_typeof(item->'isSalesHandover')='boolean' ORDER BY position LIMIT 1) h
      WHERE h.item->>'isSalesHandover'='true' AND (u.scope IN ('ALL','DEPARTMENT') OR h.item->>'assignedToUserId' IN (u.id,'ALL_SALES')))
    ELSE NOT p_write AND l.assigned_to_user_id=u.id END)
$$;
REVOKE ALL ON FUNCTION crm_backend.crm_can_access_lead(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_backend.crm_can_access_lead(text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.lead_is_active(p_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM crm_backend.lead_archives WHERE lead_id=p_id)
$$;
REVOKE ALL ON FUNCTION crm_backend.lead_is_active(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_backend.lead_is_active(text) TO authenticated,service_role;
DROP POLICY IF EXISTS crm_lead_active_guard ON public.leads;
CREATE POLICY crm_lead_active_guard ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
 USING(crm_backend.lead_is_active(id));
DROP POLICY IF EXISTS crm_lead_active_update_guard ON public.leads;
CREATE POLICY crm_lead_active_update_guard ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(crm_backend.lead_is_active(id)) WITH CHECK(crm_backend.lead_is_active(id));
DROP POLICY IF EXISTS crm_active_activity_guard ON public.lead_activities;
CREATE POLICY crm_active_activity_guard ON public.lead_activities AS RESTRICTIVE FOR SELECT TO authenticated
 USING(crm_backend.lead_is_active(lead_id));
DROP POLICY IF EXISTS crm_workspace_lead_read ON public.leads;
CREATE POLICY crm_workspace_lead_read ON public.leads FOR SELECT TO authenticated
 USING(crm_backend.crm_can_access_lead(id,false));
DROP POLICY IF EXISTS crm_workspace_activity_read ON public.lead_activities;
CREATE POLICY crm_workspace_activity_read ON public.lead_activities FOR SELECT TO authenticated
 USING(crm_backend.crm_can_access_lead(lead_id,false));

CREATE OR REPLACE FUNCTION crm_backend.assign_incoming_meta_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE company text; target public.app_users%ROWTYPE; next_turn bigint; actor text;
BEGIN
 IF nullif(NEW.assigned_to_user_id,'') IS NOT NULL OR NOT (
  NEW.source IN ('META_ADS','FACEBOOK','INSTAGRAM') OR NEW.meta_lead_id IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.meta_lead_events e WHERE e.lead_id=NEW.id)
 ) OR EXISTS(SELECT 1 FROM crm_backend.lead_archives WHERE lead_id=NEW.id) THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  SELECT u.role INTO actor FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id WHERE i.auth_user_id=auth.uid() AND i.active;
  IF actor IS DISTINCT FROM 'ADMIN' THEN RETURN NEW; END IF;
 END IF;
 SELECT company_name INTO company FROM crm_backend.lead_workspace WHERE singleton;
 IF company IS NULL THEN RAISE EXCEPTION 'crm_meta_workspace_missing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('meta-round-robin:'||company,0));
 INSERT INTO crm_backend.meta_distribution_state(company_name) VALUES(company) ON CONFLICT DO NOTHING;
 SELECT u.* INTO target FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
 LEFT JOIN crm_backend.meta_distribution_turns t ON t.company_name=u.company_name AND t.app_user_id=u.id
 WHERE u.company_name=company AND u.department='Müşteri İlişkileri' AND u.role<>'ADMIN'
 ORDER BY coalesce(t.last_turn,0),u.created_at,u.id LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 UPDATE crm_backend.meta_distribution_state SET turn=turn+1,last_assigned_user_id=target.id,updated_at=clock_timestamp()
 WHERE company_name=company RETURNING turn INTO next_turn;
 INSERT INTO crm_backend.meta_distribution_turns(company_name,app_user_id,last_turn) VALUES(company,target.id,next_turn)
 ON CONFLICT(company_name,app_user_id) DO UPDATE SET last_turn=excluded.last_turn;
 NEW.assigned_to_user_id:=target.id;NEW.assigned_to_user_name:=target.full_name;NEW.owner:=target.full_name;
 NEW.assignment_history:=coalesce(NEW.assignment_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
  'id','meta-assignment-'||next_turn,'assignedToUserId',target.id,'assignedToUserName',target.full_name,
  'assignedByUserId','system','assignedByUserName','Otomatik Dağıtım','assignedAt',clock_timestamp(),
  'note','Sunucuda sırayla otomatik atandı.'));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.assign_incoming_meta_lead() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS a_crm_assign_incoming_meta_lead ON public.leads;
CREATE TRIGGER a_crm_assign_incoming_meta_lead BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION crm_backend.assign_incoming_meta_lead();

CREATE OR REPLACE FUNCTION public.crm_assign_pending_meta_leads() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=public.crm_get_my_profile(); target text; count integer:=0;
BEGIN
 IF actor->>'role'<>'ADMIN' OR coalesce((actor->>'must_change_password')::boolean,true) THEN RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE='42501'; END IF;
 FOR target IN SELECT l.id FROM public.leads l JOIN crm_backend.lead_workspace w ON w.company_name=actor->>'company_name'
 WHERE nullif(l.assigned_to_user_id,'') IS NULL AND (l.source IN ('META_ADS','FACEBOOK','INSTAGRAM') OR l.meta_lead_id IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM crm_backend.lead_archives a WHERE a.lead_id=l.id) ORDER BY l.created_at,l.id FOR UPDATE OF l LOOP
  UPDATE public.leads SET updated_at=clock_timestamp() WHERE id=target AND nullif(assigned_to_user_id,'') IS NULL;
  IF EXISTS(SELECT 1 FROM public.leads WHERE id=target AND nullif(assigned_to_user_id,'') IS NOT NULL) THEN count:=count+1; END IF;
 END LOOP;
 RETURN count;
END $$;
REVOKE ALL ON FUNCTION public.crm_assign_pending_meta_leads() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_assign_pending_meta_leads() TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.assign_after_meta_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.leads SET updated_at=clock_timestamp()
 WHERE id=NEW.lead_id AND nullif(assigned_to_user_id,'') IS NULL
 AND NOT EXISTS(SELECT 1 FROM crm_backend.lead_archives WHERE lead_id=NEW.lead_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.assign_after_meta_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_assign_after_meta_event ON public.meta_lead_events;
CREATE TRIGGER crm_assign_after_meta_event AFTER INSERT ON public.meta_lead_events
FOR EACH ROW EXECUTE FUNCTION crm_backend.assign_after_meta_event();
CREATE TABLE IF NOT EXISTS crm_backend.lead_work_requests(
 actor uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 command jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor,request_id)
);
ALTER TABLE crm_backend.lead_work_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.lead_work_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_update_lead_work(
  p_request uuid, p_id text, p_expected timestamptz, p_change jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor jsonb;
  lead public.leads%ROWTYPE;
  assignee public.app_users%ROWTYPE;
  stage_value text;
  qualified_value boolean;
  activity_type text;
  activity_id text := 'crm-work-' || p_request::text;
  sales_target text;
  sales_name text;
  prior crm_backend.lead_work_requests%ROWTYPE;
  command jsonb:=jsonb_build_object('id',p_id,'expected',p_expected,'change',p_change);
  result jsonb;
BEGIN
  actor := public.crm_get_my_profile();
  IF NOT crm_backend.crm_can_access_lead(p_id, true) THEN
    RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_request IS NULL OR p_expected IS NULL OR jsonb_typeof(p_change) IS DISTINCT FROM 'object'
    OR p_change = '{}'::jsonb OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_change) AS k
      WHERE k NOT IN ('notes', 'callStatus', 'stage', 'isQualified', 'assignedToUserId', 'salesTarget', 'salesNote',
        'fullName', 'phone', 'whatsappPhone', 'secondaryPhone', 'email', 'budget', 'preferredHousingType')
    )
  THEN RAISE EXCEPTION 'crm_invalid_lead_change' USING ERRCODE = '22023'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('lead-work:'||auth.uid()::text||p_request::text,0));
  SELECT r.* INTO prior FROM crm_backend.lead_work_requests r WHERE r.actor=auth.uid() AND r.request_id=p_request;
  IF FOUND THEN
    IF prior.command<>command THEN RAISE EXCEPTION 'crm_invalid_lead_change' USING ERRCODE='22023'; END IF;
    RETURN prior.result;
  END IF;

  SELECT * INTO lead FROM public.leads WHERE id = p_id FOR UPDATE;
  IF NOT crm_backend.crm_can_access_lead(p_id, true) THEN
    RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
  END IF;
  IF lead.updated_at IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'crm_lead_conflict' USING ERRCODE = '40001';
  END IF;

  IF p_change ?| ARRAY['fullName','phone','whatsappPhone','secondaryPhone','email','budget','preferredHousingType'] THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_each(p_change) AS f(key, value)
      WHERE (key IN ('fullName','phone') AND (jsonb_typeof(value) <> 'string' OR btrim(value #>> '{}') = ''))
        OR (key IN ('whatsappPhone','secondaryPhone','email','preferredHousingType') AND jsonb_typeof(value) NOT IN ('string','null'))
        OR (key IN ('phone','whatsappPhone','secondaryPhone') AND length(value #>> '{}') > 40)
        OR (key IN ('fullName','email','preferredHousingType') AND length(value #>> '{}') > 254)
        OR (key = 'budget' AND jsonb_typeof(value) NOT IN ('number','null'))
    ) THEN RAISE EXCEPTION 'crm_invalid_lead_change' USING ERRCODE = '22023'; END IF;
    IF p_change ? 'fullName' THEN lead.full_name := btrim(p_change->>'fullName'); END IF;
    IF p_change ? 'phone' THEN lead.phone := btrim(p_change->>'phone'); END IF;
    IF p_change ? 'whatsappPhone' THEN lead.whatsapp_phone := p_change->>'whatsappPhone'; END IF;
    IF p_change ? 'secondaryPhone' THEN lead.secondary_phone := p_change->>'secondaryPhone'; END IF;
    IF p_change ? 'email' THEN lead.email := p_change->>'email'; END IF;
    IF p_change ? 'preferredHousingType' THEN lead.preferred_housing_type := p_change->>'preferredHousingType'; END IF;
    IF p_change ? 'budget' THEN lead.budget := (p_change->>'budget')::numeric; END IF;
    IF lead.budget < 0 THEN RAISE EXCEPTION 'crm_invalid_lead_change' USING ERRCODE = '22023'; END IF;
    activity_type := 'NOTE';
  END IF;

  IF p_change ? 'assignedToUserId' THEN
    IF coalesce(actor->'permissions'->>'canAssignConsultant', 'true') = 'false'
      AND actor->>'role' <> 'ADMIN' AND actor->>'department' <> 'Yönetim' THEN
      RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
    END IF;
    IF nullif(p_change->>'assignedToUserId', '') IS NOT NULL THEN
      SELECT u.* INTO assignee FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id = u.id
      WHERE u.id = p_change->>'assignedToUserId' AND u.company_name = actor->>'company_name'
        AND i.active AND NOT u.must_change_password AND u.department = 'Müşteri İlişkileri';
      IF NOT FOUND THEN RAISE EXCEPTION 'crm_invalid_consultant' USING ERRCODE = '22023'; END IF;
    END IF;
    lead.assigned_to_user_id := assignee.id;
    lead.assigned_to_user_name := assignee.full_name;
    lead.owner := coalesce(assignee.full_name, 'Atanmamış');
    activity_type := 'ASSIGNMENT';
  END IF;
  IF p_change ? 'salesTarget' THEN
    sales_target := nullif(p_change->>'salesTarget', '');
    IF sales_target IS NOT NULL AND sales_target <> 'ALL_SALES' THEN
      SELECT u.full_name INTO sales_name FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id = u.id
      WHERE u.id = sales_target AND u.company_name = actor->>'company_name'
        AND i.active AND NOT u.must_change_password AND u.department = 'Satış';
      IF NOT FOUND THEN RAISE EXCEPTION 'crm_invalid_consultant' USING ERRCODE = '22023'; END IF;
    ELSIF sales_target = 'ALL_SALES' THEN
      sales_name := 'Satış Ekibi (Genel Havuz)';
    END IF;
    IF length(coalesce(p_change->>'salesNote', '')) > 10000 THEN
      RAISE EXCEPTION 'crm_invalid_lead_note' USING ERRCODE = '22023';
    END IF;
    lead.assignment_history := jsonb_build_array(jsonb_build_object('id', activity_id,
      'assignedToUserId', coalesce(sales_target, ''), 'assignedToUserName', coalesce(sales_name, 'Satış Devri Geri Çekildi'),
      'assignedByUserId', actor->>'id', 'assignedByUserName', actor->>'full_name',
      'assignedByDepartment', actor->>'department', 'assignedAt', clock_timestamp(),
      'isSalesHandover', sales_target IS NOT NULL, 'note', p_change->>'salesNote'))
      || CASE WHEN jsonb_typeof(lead.assignment_history) = 'array' THEN lead.assignment_history ELSE '[]'::jsonb END;
    activity_type := 'ASSIGNMENT';
  END IF;
  IF p_change ? 'notes' THEN
    IF jsonb_typeof(p_change->'notes') <> 'string' OR length(p_change->>'notes') > 20000 THEN
      RAISE EXCEPTION 'crm_invalid_lead_note' USING ERRCODE = '22023';
    END IF;
    lead.notes := p_change->>'notes';
    activity_type := 'NOTE';
  END IF;
  IF p_change ? 'callStatus' THEN
    IF coalesce(p_change->>'callStatus','') NOT IN ('WAITING','CALLED','CALL_AGAIN','UNREACHABLE',
      'INFO_GIVEN','UNDECIDED','APPOINTMENT_SET','NO_INTENT') THEN
      RAISE EXCEPTION 'crm_invalid_call_status' USING ERRCODE = '22023';
    END IF;
    lead.call_status := p_change->>'callStatus';
    activity_type := 'CALL';
  END IF;
  IF p_change ? 'stage' OR p_change ? 'isQualified' THEN
    IF coalesce(actor->'permissions'->>'canChangeStage', 'true') = 'false'
      AND actor->>'role' <> 'ADMIN' AND actor->>'department' <> 'Yönetim' THEN
      RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
    END IF;
    stage_value := CASE WHEN p_change ? 'stage' THEN p_change->>'stage' ELSE lead.stage END;
    qualified_value := CASE WHEN p_change ? 'isQualified' THEN (p_change->>'isQualified')::boolean ELSE lead.is_qualified END;
    IF stage_value IS NULL OR stage_value NOT IN ('NEW','CONTACTED','UNDECIDED','NO_INTENT','QUALIFIED','APPOINTMENT','PRESENTATION','OFFER','WON','LOST')
      OR qualified_value IS NULL OR (stage_value='QUALIFIED' AND NOT qualified_value)
      OR (stage_value IN ('LOST','NO_INTENT') AND qualified_value)
    THEN RAISE EXCEPTION 'crm_invalid_stage' USING ERRCODE = '22023'; END IF;
    IF stage_value IS DISTINCT FROM lead.stage THEN
      lead.stage_history := jsonb_build_array(jsonb_build_object('id', activity_id, 'fromStage', lead.stage,
        'toStage', stage_value, 'changedByUserId', actor->>'id', 'changedByUserName', actor->>'full_name',
        'changedAt', clock_timestamp())) || coalesce(lead.stage_history, '[]'::jsonb);
    END IF;
    lead.stage := stage_value;
    lead.is_qualified := qualified_value;
    lead.qualified_at := CASE WHEN qualified_value THEN coalesce(lead.qualified_at, clock_timestamp()) END;
    lead.qualified_by_user_name := CASE WHEN qualified_value THEN coalesce(lead.qualified_by_user_name, actor->>'full_name') END;
    activity_type := 'STAGE_CHANGE';
  END IF;

  UPDATE public.leads
    SET notes = lead.notes, call_status = lead.call_status, full_name = lead.full_name, phone = lead.phone,
      secondary_phone = lead.secondary_phone, whatsapp_phone = lead.whatsapp_phone, email = lead.email,
      preferred_housing_type = lead.preferred_housing_type, budget = lead.budget,
      assigned_to_user_id = lead.assigned_to_user_id, assigned_to_user_name = lead.assigned_to_user_name,
      owner = lead.owner, assignment_history = lead.assignment_history, stage = lead.stage,
      is_qualified = lead.is_qualified, stage_history = lead.stage_history,
      qualified_at = lead.qualified_at, qualified_by_user_name = lead.qualified_by_user_name,
      updated_at = clock_timestamp()
  WHERE id = p_id
  RETURNING * INTO lead;

  INSERT INTO public.lead_activities (id, lead_id, type, content, author)
  VALUES (activity_id, p_id, activity_type, CASE activity_type
    WHEN 'NOTE' THEN CASE WHEN p_change ? 'notes' THEN 'Müşteri açıklaması güncellendi.' ELSE 'Müşteri bilgileri güncellendi.' END
    WHEN 'CALL' THEN 'Çağrı durumu güncellendi.'
    WHEN 'ASSIGNMENT' THEN 'Danışman ataması güncellendi.'
    ELSE 'CRM aşaması güncellendi.'
  END, actor->>'full_name');

  result:=CASE WHEN crm_backend.crm_can_access_lead(p_id, false) THEN to_jsonb(lead) ELSE jsonb_build_object('id', p_id) END;
  INSERT INTO crm_backend.lead_work_requests(actor,request_id,command,result) VALUES(auth.uid(),p_request,command,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_update_lead_work(uuid, text, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_update_lead_work(uuid, text, timestamptz, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_add_lead_note(p_request uuid, p_id text, p_note text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor jsonb := public.crm_get_my_profile();
  activity_id text := 'crm-note-' || p_request::text;
BEGIN
  IF NOT crm_backend.crm_can_access_lead(p_id, true) THEN
    RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.leads WHERE id = p_id FOR UPDATE;
  IF NOT crm_backend.crm_can_access_lead(p_id, true) THEN
    RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_request IS NULL OR p_note IS NULL OR btrim(p_note) = '' OR length(p_note) > 20000 THEN
    RAISE EXCEPTION 'crm_invalid_lead_note' USING ERRCODE = '22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.lead_activities WHERE id=activity_id AND lead_id=p_id AND content=p_note AND author=actor->>'full_name') THEN RETURN activity_id; END IF;
  INSERT INTO public.lead_activities (id, lead_id, type, content, author)
  VALUES (activity_id, p_id, 'NOTE', p_note, actor->>'full_name');
  RETURN activity_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_add_lead_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_add_lead_note(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_archive_leads(p_request uuid,p_records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=public.crm_get_my_profile(); record jsonb; lead public.leads%ROWTYPE;
 command jsonb:=jsonb_build_object('action','archive','records',p_records);
 prior crm_backend.lead_archive_requests%ROWTYPE; result jsonb;
BEGIN
 IF coalesce((actor->>'must_change_password')::boolean,true) OR p_request IS NULL
  OR jsonb_typeof(p_records) IS DISTINCT FROM 'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'crm_archive_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lead-archive:'||auth.uid()::text||p_request::text,0));
 SELECT r.* INTO prior FROM crm_backend.lead_archive_requests r WHERE r.actor=auth.uid() AND r.request_id=p_request;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'crm_archive_conflict'; END IF; RETURN prior.result; END IF;
 IF actor->>'role'<>'ADMIN' AND actor->>'department'<>'Müşteri İlişkileri' THEN RAISE EXCEPTION 'crm_archive_forbidden' USING ERRCODE='42501'; END IF;
 FOR record IN SELECT item FROM jsonb_array_elements(p_records) item ORDER BY item->>'id' LOOP
  IF jsonb_typeof(record) IS DISTINCT FROM 'object' OR jsonb_typeof(record->'id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(record->'expected') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'crm_archive_invalid'; END IF;
  SELECT * INTO lead FROM public.leads WHERE id=record->>'id' FOR UPDATE;
  IF NOT FOUND OR NOT crm_backend.crm_can_access_lead(lead.id,true)
   OR (actor->>'role'<>'ADMIN' AND lead.assigned_to_user_id IS DISTINCT FROM actor->>'id')
   THEN RAISE EXCEPTION 'crm_archive_forbidden' USING ERRCODE='42501'; END IF;
  IF lead.updated_at<>(record->>'expected')::timestamptz THEN RAISE EXCEPTION 'crm_archive_conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO crm_backend.lead_archives(lead_id,company_name,archived_by)
  VALUES(lead.id,actor->>'company_name',actor->>'id');
  UPDATE public.leads SET updated_at=clock_timestamp() WHERE id=lead.id;
 END LOOP;
 result:=jsonb_build_object('ids',(SELECT jsonb_agg(item->>'id') FROM jsonb_array_elements(p_records) item),'archived',true);
 INSERT INTO crm_backend.lead_archive_requests(actor,request_id,command,result) VALUES(auth.uid(),p_request,command,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.crm_lead_trash_list(p_after text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=public.crm_get_my_profile(); result jsonb; more boolean;
BEGIN
 IF coalesce((actor->>'must_change_password')::boolean,true) OR p_after IS NULL THEN RAISE EXCEPTION 'crm_archive_forbidden' USING ERRCODE='42501'; END IF;
 WITH records AS (
  SELECT l.id,l.full_name,l.phone,a.archived_at,a.archived_by
  FROM crm_backend.lead_archives a JOIN public.leads l ON l.id=a.lead_id
  WHERE a.company_name=actor->>'company_name' AND l.id>p_after
   AND (actor->>'role'='ADMIN' OR (actor->>'department'='Müşteri İlişkileri' AND l.assigned_to_user_id=actor->>'id'))
  ORDER BY l.id LIMIT 101
 ), numbered AS (SELECT *,row_number() OVER(ORDER BY id) n FROM records)
 SELECT coalesce(jsonb_agg(to_jsonb(numbered)-'n' ORDER BY id) FILTER(WHERE n<=100),'[]'),count(*)>100 INTO result,more FROM numbered;
 RETURN jsonb_build_object('records',result,'has_more',more);
END $$;

CREATE OR REPLACE FUNCTION public.crm_restore_lead(p_request uuid,p_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=public.crm_get_my_profile(); lead public.leads%ROWTYPE;
 command jsonb:=jsonb_build_object('action','restore','id',p_id);
 prior crm_backend.lead_archive_requests%ROWTYPE; archived crm_backend.lead_archives%ROWTYPE; result jsonb;
BEGIN
 IF coalesce((actor->>'must_change_password')::boolean,true) OR p_request IS NULL OR p_id IS NULL
  THEN RAISE EXCEPTION 'crm_archive_forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lead-archive:'||auth.uid()::text||p_request::text,0));
 SELECT r.* INTO prior FROM crm_backend.lead_archive_requests r WHERE r.actor=auth.uid() AND r.request_id=p_request;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'crm_archive_conflict'; END IF; RETURN prior.result; END IF;
 SELECT * INTO lead FROM public.leads WHERE id=p_id FOR UPDATE;
 SELECT * INTO archived FROM crm_backend.lead_archives WHERE lead_id=p_id;
 IF archived.lead_id IS NULL OR archived.company_name<>actor->>'company_name' OR
  (actor->>'role'<>'ADMIN' AND (actor->>'department'<>'Müşteri İlişkileri' OR lead.assigned_to_user_id IS DISTINCT FROM actor->>'id'))
  THEN RAISE EXCEPTION 'crm_archive_forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM crm_backend.lead_archives WHERE lead_id=p_id;
 UPDATE public.leads SET updated_at=clock_timestamp() WHERE id=p_id;
 result:=jsonb_build_object('id',p_id,'restored',true);
 INSERT INTO crm_backend.lead_archive_requests(actor,request_id,command,result) VALUES(auth.uid(),p_request,command,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_archive_leads(uuid,jsonb),public.crm_lead_trash_list(text),public.crm_restore_lead(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_archive_leads(uuid,jsonb),public.crm_lead_trash_list(text),public.crm_restore_lead(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.meta_can_read_lead(p_user uuid,p_lead text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM meta_members m JOIN crm_identities i ON i.auth_user_id=m.auth_user_id AND i.app_user_id=m.app_user_id AND i.active
  JOIN app_users u ON u.id=i.app_user_id JOIN crm_backend.lead_workspace w ON w.company_name=u.company_name
  JOIN leads l ON l.id=p_lead WHERE m.auth_user_id=p_user AND NOT u.must_change_password
  AND NOT EXISTS(SELECT 1 FROM crm_backend.lead_archives a WHERE a.lead_id=l.id)
  AND CASE WHEN u.role='ADMIN' THEN true
   WHEN u.department='Müşteri İlişkileri' THEN l.assigned_to_user_id=u.id
   WHEN u.department='Pazarlama' THEN true
   ELSE l.assigned_to_user_id=u.id END)
$$;
REVOKE ALL ON FUNCTION public.meta_can_read_lead(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_can_read_lead(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION crm_backend.sync_meta_staff_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.meta_members(auth_user_id,app_user_id,can_send,is_admin)
 SELECT i.auth_user_id,u.id,
  NOT u.must_change_password AND (u.role='ADMIN' OR u.department IN ('Müşteri İlişkileri','Pazarlama')),
  NOT u.must_change_password AND u.role='ADMIN'
 FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id JOIN crm_backend.lead_workspace w ON w.company_name=u.company_name
 WHERE i.active
 ON CONFLICT(auth_user_id) DO UPDATE SET app_user_id=excluded.app_user_id,can_send=excluded.can_send,is_admin=excluded.is_admin;
 UPDATE public.meta_members m SET can_send=false,is_admin=false
 WHERE NOT EXISTS(SELECT 1 FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
  JOIN crm_backend.lead_workspace w ON w.company_name=u.company_name
  WHERE i.auth_user_id=m.auth_user_id AND i.active AND NOT u.must_change_password
   AND (u.role='ADMIN' OR u.department IN ('Müşteri İlişkileri','Pazarlama')));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION crm_backend.sync_meta_staff_membership() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_sync_meta_identity ON public.crm_identities;
CREATE TRIGGER crm_sync_meta_identity AFTER INSERT OR UPDATE ON public.crm_identities
FOR EACH STATEMENT EXECUTE FUNCTION crm_backend.sync_meta_staff_membership();
DROP TRIGGER IF EXISTS crm_sync_meta_profile ON public.app_users;
CREATE TRIGGER crm_sync_meta_profile AFTER INSERT OR UPDATE OF department,role,must_change_password,company_name ON public.app_users
FOR EACH STATEMENT EXECUTE FUNCTION crm_backend.sync_meta_staff_membership();
UPDATE public.app_users SET department=department WHERE false;

DO $realtime$
DECLARE name text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  CREATE PUBLICATION supabase_realtime;
 END IF;
 FOREACH name IN ARRAY ARRAY['leads','lead_activities'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=name)
   THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',name); END IF;
 END LOOP;
END $realtime$;

CREATE OR REPLACE FUNCTION public.crm_meta_intake_readiness() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'version',20261118102018::bigint,
  'assignment',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.leads'::regclass AND tgname='a_crm_assign_incoming_meta_lead' AND tgenabled<>'D'),
  'persistent_cursor',to_regclass('crm_backend.meta_distribution_state') IS NOT NULL AND to_regclass('crm_backend.meta_distribution_turns') IS NOT NULL,
  'stage_updates',to_regprocedure('public.crm_update_lead_work(uuid,text,timestamptz,jsonb)') IS NOT NULL,
  'lead_trash',to_regprocedure('public.crm_archive_leads(uuid,jsonb)') IS NOT NULL AND to_regprocedure('public.crm_restore_lead(uuid,text)') IS NOT NULL,
  'personal_visibility',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='crm_representative_read_guard' AND permissive='RESTRICTIVE'),
  'archive_visibility',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='crm_lead_active_guard' AND permissive='RESTRICTIVE'),
  'realtime',EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='leads')
 )
$$;
REVOKE ALL ON FUNCTION public.crm_meta_intake_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_meta_intake_readiness() TO anon,authenticated,service_role;

COMMIT;



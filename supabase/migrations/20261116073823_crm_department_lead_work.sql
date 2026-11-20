BEGIN;

CREATE TABLE IF NOT EXISTS crm_backend.lead_workspace (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  company_name text NOT NULL CHECK (btrim(company_name) <> '')
);
REVOKE ALL ON crm_backend.lead_workspace FROM PUBLIC, anon, authenticated;

-- Lead rows have no company column. Use the verified Meta workspace owner.
DO $$
DECLARE
  company text;
  company_count int;
BEGIN
  SELECT min(u.company_name), count(DISTINCT u.company_name)
    INTO company, company_count
  FROM public.meta_members m
  JOIN public.crm_identities i ON i.auth_user_id = m.auth_user_id AND i.app_user_id = m.app_user_id AND i.active
  JOIN public.app_users u ON u.id = i.app_user_id
  WHERE m.is_admin AND u.role = 'ADMIN' AND NOT u.must_change_password
    AND btrim(u.company_name) <> '';

  IF company_count <> 1 OR EXISTS (
    SELECT 1 FROM crm_backend.lead_workspace WHERE company_name <> company
  ) THEN
    RAISE EXCEPTION 'CRM lead workspace requires one verified company';
  END IF;
  INSERT INTO crm_backend.lead_workspace (company_name) VALUES (company) ON CONFLICT DO NOTHING;
END $$;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS call_status text;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON public.leads, public.lead_activities FROM PUBLIC, anon;
GRANT SELECT ON public.leads, public.lead_activities TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.crm_can_access_lead(p_id text, p_write boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_identities i
    JOIN public.app_users u ON u.id = i.app_user_id
    JOIN crm_backend.lead_workspace w ON w.company_name = u.company_name
    JOIN public.leads l ON l.id = p_id
    WHERE i.auth_user_id = auth.uid() AND i.active AND NOT u.must_change_password
      AND CASE
        WHEN u.role = 'ADMIN' OR u.department = 'Yönetim' THEN true
        WHEN u.department = 'Müşteri İlişkileri' THEN
          u.scope IN ('ALL', 'DEPARTMENT') OR l.assigned_to_user_id = u.id
        WHEN u.department = 'Pazarlama' THEN NOT p_write
          AND l.source IN ('META_ADS', 'FACEBOOK', 'INSTAGRAM')
          AND (u.scope IN ('ALL', 'DEPARTMENT') OR l.assigned_to_user_id = u.id)
        WHEN u.department = 'Satış' THEN NOT p_write AND EXISTS (
          SELECT 1 FROM (
            SELECT item
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.assignment_history) = 'array'
              THEN l.assignment_history ELSE '[]'::jsonb END) WITH ORDINALITY a(item, position)
            WHERE jsonb_typeof(item->'isSalesHandover') = 'boolean'
            ORDER BY position LIMIT 1
          ) h
          WHERE h.item->>'isSalesHandover' = 'true'
            AND (u.scope IN ('ALL', 'DEPARTMENT') OR h.item->>'assignedToUserId' IN (u.id, 'ALL_SALES'))
        )
        ELSE NOT p_write AND l.assigned_to_user_id = u.id
      END
  )
$$;
REVOKE ALL ON FUNCTION crm_backend.crm_can_access_lead(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_backend.crm_can_access_lead(text, boolean) TO authenticated;

DROP POLICY IF EXISTS crm_lead_read ON public.leads;
CREATE POLICY crm_lead_read ON public.leads FOR SELECT TO authenticated
  USING (crm_backend.crm_can_access_lead(id, false));
DROP POLICY IF EXISTS crm_lead_read_guard ON public.leads;
CREATE POLICY crm_lead_read_guard ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (crm_backend.crm_can_access_lead(id, false));

DROP POLICY IF EXISTS crm_activity_read ON public.lead_activities;
CREATE POLICY crm_activity_read ON public.lead_activities FOR SELECT TO authenticated
  USING (crm_backend.crm_can_access_lead(lead_id, false));
DROP POLICY IF EXISTS crm_activity_read_guard ON public.lead_activities;
CREATE POLICY crm_activity_read_guard ON public.lead_activities AS RESTRICTIVE FOR SELECT TO authenticated
  USING (crm_backend.crm_can_access_lead(lead_id, false));

DROP POLICY IF EXISTS crm_lead_update_guard ON public.leads;
CREATE POLICY crm_lead_update_guard ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (crm_backend.crm_can_access_lead(id, true))
  WITH CHECK (crm_backend.crm_can_access_lead(id, true));
DROP POLICY IF EXISTS crm_activity_insert_guard ON public.lead_activities;
CREATE POLICY crm_activity_insert_guard ON public.lead_activities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (crm_backend.crm_can_access_lead(lead_id, true));
DROP POLICY IF EXISTS crm_activity_update_guard ON public.lead_activities;
CREATE POLICY crm_activity_update_guard ON public.lead_activities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (crm_backend.crm_can_access_lead(lead_id, true))
  WITH CHECK (crm_backend.crm_can_access_lead(lead_id, true));

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

  RETURN CASE WHEN crm_backend.crm_can_access_lead(p_id, false) THEN to_jsonb(lead) ELSE jsonb_build_object('id', p_id) END;
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
  INSERT INTO public.lead_activities (id, lead_id, type, content, author)
  VALUES (activity_id, p_id, 'NOTE', p_note, actor->>'full_name');
  RETURN activity_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_add_lead_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_add_lead_note(uuid, text, text) TO authenticated;

COMMIT;

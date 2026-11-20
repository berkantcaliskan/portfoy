BEGIN;
CREATE OR REPLACE FUNCTION public.crm_create_manual_lead(p_request uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor jsonb:=public.crm_get_my_profile();
 prior crm_backend.manual_lead_requests%ROWTYPE;
 saved public.leads%ROWTYPE;
 assignee public.app_users%ROWTYPE;
 target_id text;
 stamp timestamptz:=clock_timestamp();
 record_id text:='crm-manual-'||p_request::text;
BEGIN
 IF auth.uid() IS NULL OR coalesce((actor->>'must_change_password')::boolean,true)
  OR NOT EXISTS(SELECT 1 FROM crm_backend.lead_workspace WHERE company_name=actor->>'company_name')
  OR (actor->>'role'<>'ADMIN' AND (actor->>'department'<>'Müşteri İlişkileri'
    OR coalesce(actor->'permissions'->>'canAddCustomer','true')='false')) THEN
  RAISE EXCEPTION 'crm_manual_lead_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_request IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
  OR octet_length(p_payload::text)>30000 OR EXISTS (
   SELECT 1 FROM jsonb_each(p_payload) item WHERE jsonb_typeof(item.value)<>'string'
    OR item.key NOT IN ('fullName','phone','notes','stage','callStatus','assignedToUserId','preferredHousingType')
  )
  OR length(btrim(coalesce(p_payload->>'fullName',''))) NOT BETWEEN 1 AND 254
  OR length(coalesce(p_payload->>'phone',''))>40
  OR length(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g')) NOT BETWEEN 10 AND 15
  OR length(coalesce(p_payload->>'notes',''))>20000
  OR length(coalesce(p_payload->>'preferredHousingType',''))>254
  OR coalesce(p_payload->>'stage','') NOT IN ('NEW','CONTACTED','QUALIFIED','OFFER','WON','LOST')
  OR coalesce(p_payload->>'callStatus','') NOT IN ('WAITING','CALLED','CALL_AGAIN','UNREACHABLE','INFO_GIVEN','UNDECIDED','APPOINTMENT_SET','NO_INTENT')
 THEN RAISE EXCEPTION 'crm_manual_lead_invalid' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual-lead:'||auth.uid()::text||p_request::text,0));
 SELECT r.* INTO prior FROM crm_backend.manual_lead_requests r WHERE r.actor=auth.uid() AND r.request_id=p_request;
 IF FOUND THEN
  IF prior.command<>p_payload THEN RAISE EXCEPTION 'crm_manual_lead_conflict'; END IF;
  RETURN prior.result;
 END IF;
 target_id:=nullif(p_payload->>'assignedToUserId','');
 IF actor->>'role'<>'ADMIN' AND actor->>'department'='Müşteri İlişkileri' THEN
  IF target_id IS NOT NULL AND target_id<>actor->>'id' THEN RAISE EXCEPTION 'crm_manual_lead_forbidden' USING ERRCODE='42501'; END IF;
  target_id:=actor->>'id';
 END IF;
 IF target_id IS NULL AND actor->>'department'='Müşteri İlişkileri' THEN target_id:=actor->>'id'; END IF;
 IF target_id IS NOT NULL THEN
  IF actor->>'role'<>'ADMIN' AND target_id<>actor->>'id'
   AND (actor->>'scope' NOT IN ('ALL','DEPARTMENT') OR coalesce(actor->'permissions'->>'canAssignConsultant','true')='false')
   THEN RAISE EXCEPTION 'crm_manual_lead_invalid' USING ERRCODE='22023'; END IF;
  SELECT u.* INTO assignee FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
  WHERE u.id=target_id AND u.company_name=actor->>'company_name' AND u.department='Müşteri İlişkileri';
  IF NOT FOUND THEN RAISE EXCEPTION 'crm_manual_lead_invalid' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.leads(
  id,full_name,phone,whatsapp_phone,source,form_name,channel,stage,call_status,owner,
  tags,preferred_housing_type,notes,assigned_to_user_id,assigned_to_user_name,
  inquiries,assignment_history,stage_history,is_qualified,created_at,updated_at
 ) VALUES (
  record_id,btrim(p_payload->>'fullName'),btrim(p_payload->>'phone'),btrim(p_payload->>'phone'),
  'DIRECT','Manuel Kayıt','Manuel Kayıt',p_payload->>'stage',p_payload->>'callStatus',
  coalesce(assignee.full_name,'Atanmamış'),jsonb_build_array('Manuel Kayıt',p_payload->>'preferredHousingType'),
  nullif(p_payload->>'preferredHousingType',''),nullif(p_payload->>'notes',''),assignee.id,assignee.full_name,
  jsonb_build_array(jsonb_build_object('id',record_id,'formName','Manuel Kayıt','source','DIRECT',
    'channel','Manuel Kayıt','notes',p_payload->>'notes','preferredHousingType',p_payload->>'preferredHousingType','createdAt',stamp)),
  CASE WHEN assignee.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
    'id',record_id,'assignedToUserId',assignee.id,'assignedToUserName',assignee.full_name,
    'assignedByUserId',actor->>'id','assignedByUserName',actor->>'full_name','assignedAt',stamp,
    'note','Müşteri oluşturulurken atandı.')) END,
  jsonb_build_array(jsonb_build_object('id',record_id,'toStage',p_payload->>'stage',
    'changedByUserId',actor->>'id','changedByUserName',actor->>'full_name','changedAt',stamp,'note','Manuel müşteri kaydı oluşturuldu.')),
  p_payload->>'stage'='QUALIFIED',stamp,stamp
 ) RETURNING * INTO saved;
 INSERT INTO public.lead_activities(id,lead_id,type,content,author,created_at)
 VALUES(record_id,record_id,'STAGE_CHANGE','Manuel müşteri kaydı oluşturuldu.',actor->>'full_name',stamp);
 INSERT INTO crm_backend.manual_lead_requests(actor,request_id,command,result)
 VALUES(auth.uid(),p_request,p_payload,to_jsonb(saved));
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.crm_create_manual_lead(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_manual_lead(uuid,jsonb) TO authenticated;

UPDATE public.app_users SET scope='ASSIGNED_ONLY',
 permissions=coalesce(permissions,'{}'::jsonb)||'{"canAssignConsultant":false}'::jsonb
WHERE department='Müşteri İlişkileri' AND role<>'ADMIN';

CREATE OR REPLACE FUNCTION crm_backend.crm_representative_read_allowed(assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT CASE
  WHEN u.role='ADMIN' OR u.department<>'Müşteri İlişkileri' THEN true
  ELSE assignee=u.id AND EXISTS(SELECT 1 FROM crm_backend.lead_workspace w WHERE w.company_name=u.company_name)
 END FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
 WHERE i.auth_user_id=auth.uid() AND i.active AND NOT u.must_change_password),false)
$$;
CREATE OR REPLACE FUNCTION crm_backend.crm_representative_owns(assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
 JOIN crm_backend.lead_workspace w ON w.company_name=u.company_name
 WHERE i.auth_user_id=auth.uid() AND i.active AND NOT u.must_change_password
  AND u.department='Müşteri İlişkileri' AND u.role<>'ADMIN' AND u.id=assignee)
$$;
CREATE OR REPLACE FUNCTION crm_backend.crm_representative_activity_allowed(lead text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT crm_backend.crm_representative_read_allowed(l.assigned_to_user_id)
 FROM public.leads l WHERE l.id=lead),false)
$$;
REVOKE ALL ON FUNCTION crm_backend.crm_representative_read_allowed(text),crm_backend.crm_representative_owns(text),crm_backend.crm_representative_activity_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_backend.crm_representative_read_allowed(text),crm_backend.crm_representative_owns(text),crm_backend.crm_representative_activity_allowed(text) TO authenticated;

DROP POLICY IF EXISTS crm_representative_read_guard ON public.leads;
CREATE POLICY crm_representative_read_guard ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
 USING(crm_backend.crm_representative_read_allowed(assigned_to_user_id));
DROP POLICY IF EXISTS crm_representative_own_read ON public.leads;
CREATE POLICY crm_representative_own_read ON public.leads FOR SELECT TO authenticated
 USING(crm_backend.crm_representative_owns(assigned_to_user_id));
DROP POLICY IF EXISTS crm_representative_update_guard ON public.leads;
CREATE POLICY crm_representative_update_guard ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(crm_backend.crm_representative_read_allowed(assigned_to_user_id))
 WITH CHECK(crm_backend.crm_representative_read_allowed(assigned_to_user_id));
DROP POLICY IF EXISTS crm_representative_activity_guard ON public.lead_activities;
CREATE POLICY crm_representative_activity_guard ON public.lead_activities AS RESTRICTIVE FOR SELECT TO authenticated
 USING(crm_backend.crm_representative_activity_allowed(lead_id));
DROP POLICY IF EXISTS crm_representative_activity_read ON public.lead_activities;
CREATE POLICY crm_representative_activity_read ON public.lead_activities FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND crm_backend.crm_representative_owns(l.assigned_to_user_id)));

CREATE TABLE IF NOT EXISTS crm_backend.lead_transfer_requests(
 actor uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 lead_id text NOT NULL,
 previous_assignee text NOT NULL,
 target_id text NOT NULL,
 expected timestamptz NOT NULL,
 transaction_id bigint NOT NULL,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor,request_id)
);
ALTER TABLE crm_backend.lead_transfer_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.lead_transfer_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_backend.guard_representative_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE representative text;
BEGIN
 SELECT u.id INTO representative FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
 WHERE i.auth_user_id=auth.uid() AND i.active AND u.department='Müşteri İlişkileri' AND u.role<>'ADMIN';
 IF representative IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.assigned_to_user_id IS DISTINCT FROM representative THEN RAISE EXCEPTION 'crm_transfer_forbidden' USING ERRCODE='42501'; END IF;
 ELSIF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
  IF OLD.assigned_to_user_id IS DISTINCT FROM representative OR NOT EXISTS(
   SELECT 1 FROM crm_backend.lead_transfer_requests r WHERE r.actor=auth.uid() AND r.lead_id=NEW.id
    AND r.previous_assignee=OLD.assigned_to_user_id AND r.target_id=NEW.assigned_to_user_id
    AND r.transaction_id=txid_current() AND r.result IS NULL
  ) THEN RAISE EXCEPTION 'crm_transfer_forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.guard_representative_assignment() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_guard_representative_assignment ON public.leads;
CREATE TRIGGER crm_guard_representative_assignment BEFORE INSERT OR UPDATE OF assigned_to_user_id
ON public.leads FOR EACH ROW EXECUTE FUNCTION crm_backend.guard_representative_assignment();

CREATE OR REPLACE FUNCTION public.crm_transfer_lead(p_request uuid,p_id text,p_expected timestamptz,p_target text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor jsonb:=public.crm_get_my_profile();
 prior crm_backend.lead_transfer_requests%ROWTYPE;
 lead public.leads%ROWTYPE;
 target public.app_users%ROWTYPE;
 transfer_result jsonb;
 stamp timestamptz:=clock_timestamp();
BEGIN
 IF coalesce((actor->>'must_change_password')::boolean,true) OR actor->>'department'<>'Müşteri İlişkileri'
  OR actor->>'role'='ADMIN' OR NOT EXISTS(SELECT 1 FROM crm_backend.lead_workspace w WHERE w.company_name=actor->>'company_name')
  THEN RAISE EXCEPTION 'crm_transfer_forbidden' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_id IS NULL OR p_expected IS NULL OR p_target IS NULL OR p_target=actor->>'id'
  THEN RAISE EXCEPTION 'crm_transfer_invalid' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lead-transfer:'||auth.uid()::text||p_request::text,0));
 SELECT r.* INTO prior FROM crm_backend.lead_transfer_requests r WHERE r.actor=auth.uid() AND r.request_id=p_request;
 IF FOUND THEN
  IF prior.lead_id<>p_id OR prior.target_id<>p_target OR prior.expected<>p_expected THEN RAISE EXCEPTION 'crm_transfer_invalid' USING ERRCODE='22023'; END IF;
  RETURN prior.result;
 END IF;
 SELECT * INTO lead FROM public.leads WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR lead.assigned_to_user_id IS DISTINCT FROM actor->>'id' THEN RAISE EXCEPTION 'crm_transfer_forbidden' USING ERRCODE='42501'; END IF;
 IF lead.updated_at<>p_expected THEN RAISE EXCEPTION 'crm_transfer_conflict' USING ERRCODE='40001'; END IF;
 SELECT u.* INTO target FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
 WHERE u.id=p_target AND u.company_name=actor->>'company_name' AND u.department='Müşteri İlişkileri' AND u.role<>'ADMIN';
 IF NOT FOUND THEN RAISE EXCEPTION 'crm_transfer_invalid' USING ERRCODE='22023'; END IF;
 INSERT INTO crm_backend.lead_transfer_requests(actor,request_id,lead_id,previous_assignee,target_id,expected,transaction_id)
 VALUES(auth.uid(),p_request,p_id,actor->>'id',p_target,p_expected,txid_current());
 UPDATE public.leads SET assigned_to_user_id=target.id,assigned_to_user_name=target.full_name,owner=target.full_name,updated_at=stamp,
 assignment_history=coalesce(lead.assignment_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
  'id','transfer-'||p_request::text,'assignedToUserId',target.id,'assignedToUserName',target.full_name,
  'assignedByUserId',actor->>'id','assignedByUserName',actor->>'full_name','assignedAt',stamp,'note','Temsilciler arası müşteri devri.'))
 WHERE id=p_id;
 INSERT INTO public.lead_activities(id,lead_id,type,content,author,created_at)
 VALUES('transfer-'||p_request::text,p_id,'ASSIGNMENT','Müşteri '||target.full_name||' temsilcisine devredildi.',actor->>'full_name',stamp);
 transfer_result:=jsonb_build_object('id',p_id,'transferred',true);
 UPDATE crm_backend.lead_transfer_requests r SET result=transfer_result
 WHERE r.actor=auth.uid() AND r.request_id=p_request;
 RETURN transfer_result;
END $$;
REVOKE ALL ON FUNCTION public.crm_transfer_lead(uuid,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_transfer_lead(uuid,text,timestamptz,text) TO authenticated;

COMMIT;


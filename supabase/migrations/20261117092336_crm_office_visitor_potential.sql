BEGIN;

CREATE OR REPLACE FUNCTION public.crm_office_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); allowed boolean;
BEGIN
 allowed:=crm_backend.office_allowed(p);
 RETURN jsonb_build_object('canAccess',allowed,'visitorPotentialColors',true,'isAdmin',p->>'role'='ADMIN',
 'assignments',CASE WHEN p->>'role'='ADMIN' THEN (SELECT coalesce(jsonb_agg(u.id),'[]') FROM public.app_users u JOIN crm_backend.office_access a ON a.app_user_id=u.id JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name') ELSE '[]'::jsonb END,
 'consultants',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'department',u.department) ORDER BY u.full_name),'[]') FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name') ELSE '[]'::jsonb END,
 'representatives',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'department',u.department) ORDER BY u.full_name),'[]') FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name') ELSE '[]'::jsonb END);
END $$;
CREATE OR REPLACE FUNCTION public.crm_office_save(p_request uuid,p_id uuid,p_kind text,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); command jsonb; prior crm_backend.office_requests%ROWTYPE; existing crm_backend.office_records%ROWTYPE; saved crm_backend.office_records%ROWTYPE; result jsonb; target_staff text; target_dept text;
BEGIN
 IF NOT crm_backend.office_allowed(p) THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 IF p_request IS NULL OR p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('visitors','contracts') OR p_revision IS NULL OR p_revision<0 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_payload) v WHERE jsonb_typeof(v.value)<>'string' OR v.key NOT IN ('name','phone','status','notes','visitedAt','staffId','representativeId','title','beneficiary','identityNo','address','property','amount','body','visitorId','potential')) THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF length(btrim(coalesce(p_payload->>'name','')))=0 OR length(p_payload->>'name')>500 OR length(btrim(coalesce(p_payload->>'phone','')))=0 OR length(p_payload->>'phone')>100 OR length(coalesce(p_payload->>'notes',''))>2000 THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF p_payload ? 'potential' AND (p_kind <> 'visitors' OR p_payload->>'potential' NOT IN ('','green','yellow','red')) THEN
  RAISE EXCEPTION 'office_invalid';
 END IF;
 IF p_kind='visitors' THEN
  IF coalesce(p_payload->>'status','') NOT IN ('WAITING','MEETING','COMPLETED') OR coalesce(p_payload->>'visitedAt','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'office_invalid'; END IF;
  BEGIN PERFORM (p_payload->>'visitedAt')::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'office_invalid'; END;
  FOREACH target_dept IN ARRAY ARRAY['Satış','Müşteri İlişkileri'] LOOP
   target_staff:=p_payload->>CASE WHEN target_dept='Satış' THEN 'staffId' ELSE 'representativeId' END;
   IF coalesce(target_staff,'')<>'' AND NOT EXISTS(SELECT 1 FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.id=target_staff AND u.company_name=p->>'company_name') THEN RAISE EXCEPTION 'office_invalid'; END IF;
  END LOOP;
 ELSE
  IF coalesce(p_payload->>'status','') NOT IN ('DRAFT','READY','SIGNED') OR length(btrim(coalesce(p_payload->>'title','')))=0 OR length(btrim(coalesce(p_payload->>'beneficiary','')))=0 OR length(btrim(coalesce(p_payload->>'body','')))=0 OR length(p_payload->>'body')>40000 THEN RAISE EXCEPTION 'office_invalid'; END IF;
  IF coalesce(p_payload->>'visitorId','')<>'' AND NOT EXISTS(SELECT 1 FROM crm_backend.office_records WHERE id::text=p_payload->>'visitorId' AND company_name=p->>'company_name' AND kind='visitors') THEN RAISE EXCEPTION 'office_invalid'; END IF;
 END IF;
 command:=jsonb_build_object('id',p_id,'kind',p_kind,'revision',p_revision,'payload',p_payload);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_request::text,0));
 SELECT * INTO prior FROM crm_backend.office_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'office_conflict'; END IF; RETURN prior.result; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,1));
 SELECT * INTO existing FROM crm_backend.office_records WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF existing.company_name<>p->>'company_name' OR existing.kind<>p_kind THEN RAISE EXCEPTION 'office_forbidden'; END IF;
  IF existing.revision<>p_revision THEN RAISE EXCEPTION 'office_conflict'; END IF;
  UPDATE crm_backend.office_records SET payload=p_payload,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO saved;
 ELSE
  IF p_revision<>0 THEN RAISE EXCEPTION 'office_conflict'; END IF;
  INSERT INTO crm_backend.office_records(id,company_name,kind,payload,revision,created_by) VALUES(p_id,p->>'company_name',p_kind,p_payload,1,auth.uid()) RETURNING * INTO saved;
 END IF;
 result:=jsonb_build_object('id',saved.id,'kind',saved.kind,'payload',saved.payload,'revision',saved.revision,'updated_at',saved.updated_at);
 INSERT INTO crm_backend.office_requests(actor,request_id,command,result) VALUES(auth.uid(),p_request,command,result);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.crm_office_context(), public.crm_office_save(uuid,uuid,text,bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_office_context(), public.crm_office_save(uuid,uuid,text,bigint,jsonb) TO authenticated;

COMMIT;

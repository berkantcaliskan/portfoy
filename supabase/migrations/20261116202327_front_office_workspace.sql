BEGIN;

-- Additional workspace; canonical departments and Meta tables are unchanged.
CREATE TABLE IF NOT EXISTS crm_backend.office_access (
 app_user_id text PRIMARY KEY REFERENCES public.app_users(id),
 granted_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_backend.office_records (
 id uuid PRIMARY KEY,
 company_name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('visitors','contracts')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 revision bigint NOT NULL CHECK(revision>0),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_records_company_kind_id ON crm_backend.office_records(company_name,kind,id);
CREATE TABLE IF NOT EXISTS crm_backend.office_requests (
 actor uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 command jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor,request_id)
);
ALTER TABLE crm_backend.office_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.office_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.office_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.office_access,crm_backend.office_records,crm_backend.office_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_backend.office_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE p jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 p:=public.crm_get_my_profile();
 IF coalesce((p->>'must_change_password')::boolean,true) THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 RETURN p;
END $$;
CREATE OR REPLACE FUNCTION crm_backend.office_allowed(p jsonb) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT p->>'role'='ADMIN' OR EXISTS(SELECT 1 FROM crm_backend.office_access WHERE app_user_id=p->>'id');
$$;
REVOKE ALL ON FUNCTION crm_backend.office_profile(),crm_backend.office_allowed(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_office_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); allowed boolean;
BEGIN
 allowed:=crm_backend.office_allowed(p);
 RETURN jsonb_build_object('canAccess',allowed,'isAdmin',p->>'role'='ADMIN',
 'assignments',CASE WHEN p->>'role'='ADMIN' THEN (SELECT coalesce(jsonb_agg(u.id),'[]') FROM public.app_users u JOIN crm_backend.office_access a ON a.app_user_id=u.id JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name') ELSE '[]'::jsonb END,
 'consultants',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) ORDER BY u.full_name),'[]') FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name' AND (u.department='Satış' OR u.departments ? 'Satış')) ELSE '[]'::jsonb END,
 'representatives',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) ORDER BY u.full_name),'[]') FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name' AND (u.department='Müşteri İlişkileri' OR u.departments ? 'Müşteri İlişkileri')) ELSE '[]'::jsonb END);
END $$;

CREATE OR REPLACE FUNCTION public.crm_office_assign(p_user_id text,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); target public.app_users%ROWTYPE;
BEGIN
 IF p->>'role'<>'ADMIN' OR p_enabled IS NULL THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 SELECT u.* INTO target FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
 WHERE u.id=p_user_id AND u.company_name=p->>'company_name' FOR UPDATE OF u;
 IF NOT FOUND OR target.role='ADMIN' THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 IF p_enabled THEN INSERT INTO crm_backend.office_access(app_user_id,granted_by) VALUES(p_user_id,auth.uid()) ON CONFLICT(app_user_id) DO UPDATE SET granted_by=excluded.granted_by,updated_at=now();
 ELSE DELETE FROM crm_backend.office_access WHERE app_user_id=p_user_id; END IF;
 INSERT INTO crm_backend.staff_admin_audit(actor,target_id,operation) VALUES(auth.uid(),p_user_id,CASE WHEN p_enabled THEN 'office_grant' ELSE 'office_revoke' END);
END $$;

CREATE OR REPLACE FUNCTION public.crm_office_list(p_kind text,p_after text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); result jsonb; has_more boolean;
BEGIN
 IF NOT crm_backend.office_allowed(p) THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 IF p_kind NOT IN ('visitors','contracts') OR p_kind IS NULL OR p_after IS NULL THEN RAISE EXCEPTION 'office_invalid'; END IF;
 WITH rows AS (SELECT id,kind,payload,revision,updated_at FROM crm_backend.office_records WHERE company_name=p->>'company_name' AND kind=p_kind AND (p_after='' OR id>nullif(p_after,'')::uuid) ORDER BY id LIMIT 201)
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id) FILTER(WHERE r.n<=200),'[]'),count(*)>200 INTO result,has_more FROM (SELECT *,row_number() OVER(ORDER BY id) AS n FROM rows) r;
 RETURN jsonb_build_object('records',result,'hasMore',has_more);
END $$;

CREATE OR REPLACE FUNCTION public.crm_office_save(p_request uuid,p_id uuid,p_kind text,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); command jsonb; prior crm_backend.office_requests%ROWTYPE; existing crm_backend.office_records%ROWTYPE; saved crm_backend.office_records%ROWTYPE; result jsonb; target_staff text; target_dept text;
BEGIN
 IF NOT crm_backend.office_allowed(p) THEN RAISE EXCEPTION 'office_forbidden'; END IF;
 IF p_request IS NULL OR p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('visitors','contracts') OR p_revision IS NULL OR p_revision<0 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_payload) v WHERE jsonb_typeof(v.value)<>'string' OR v.key NOT IN ('name','phone','status','notes','visitedAt','staffId','representativeId','title','beneficiary','identityNo','address','property','amount','body','visitorId')) THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF length(btrim(coalesce(p_payload->>'name','')))=0 OR length(p_payload->>'name')>500 OR length(btrim(coalesce(p_payload->>'phone','')))=0 OR length(p_payload->>'phone')>100 OR length(coalesce(p_payload->>'notes',''))>2000 THEN RAISE EXCEPTION 'office_invalid'; END IF;
 IF p_kind='visitors' THEN
  IF coalesce(p_payload->>'status','') NOT IN ('WAITING','MEETING','COMPLETED') OR coalesce(p_payload->>'visitedAt','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'office_invalid'; END IF;
  BEGIN PERFORM (p_payload->>'visitedAt')::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'office_invalid'; END;
  FOREACH target_dept IN ARRAY ARRAY['Satış','Müşteri İlişkileri'] LOOP
   target_staff:=p_payload->>CASE WHEN target_dept='Satış' THEN 'staffId' ELSE 'representativeId' END;
   IF coalesce(target_staff,'')<>'' AND NOT EXISTS(SELECT 1 FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.id=target_staff AND u.company_name=p->>'company_name' AND (u.department=target_dept OR u.departments ? target_dept)) THEN RAISE EXCEPTION 'office_invalid'; END IF;
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
REVOKE ALL ON FUNCTION public.crm_office_context(),public.crm_office_assign(text,boolean),public.crm_office_list(text,text),public.crm_office_save(uuid,uuid,text,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_office_context(),public.crm_office_assign(text,boolean),public.crm_office_list(text,text),public.crm_office_save(uuid,uuid,text,bigint,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

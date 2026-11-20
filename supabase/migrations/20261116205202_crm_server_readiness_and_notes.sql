BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.promissory_notes (
 id uuid PRIMARY KEY, company_name text NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 revision bigint NOT NULL CHECK(revision>0),created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promissory_company_id ON crm_backend.promissory_notes(company_name,id);
CREATE TABLE IF NOT EXISTS crm_backend.promissory_requests (
 actor uuid NOT NULL REFERENCES auth.users(id),request_id uuid NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor,request_id)
);
ALTER TABLE crm_backend.promissory_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.promissory_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.promissory_notes,crm_backend.promissory_requests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION crm_backend.note_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile();
BEGIN
 IF auth.uid() IS NULL OR coalesce((p->>'must_change_password')::boolean,true)
 OR NOT(p->>'role'='ADMIN' OR p->>'department'='Muhasebe' OR coalesce(p->'departments','[]') ? 'Muhasebe') THEN RAISE EXCEPTION 'note_forbidden'; END IF;
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION crm_backend.note_profile() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.crm_note_list(p_after text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.note_profile(); result jsonb; has_more boolean;
BEGIN
 IF p_after IS NULL THEN RAISE EXCEPTION 'note_invalid'; END IF;
 WITH rows AS(SELECT id,payload,revision,updated_at FROM crm_backend.promissory_notes WHERE company_name=p->>'company_name' AND (p_after='' OR id>nullif(p_after,'')::uuid) ORDER BY id LIMIT 101)
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id) FILTER(WHERE r.n<=100),'[]'),count(*)>100 INTO result,has_more FROM(SELECT *,row_number() OVER(ORDER BY id) n FROM rows) r;
 RETURN jsonb_build_object('records',result,'hasMore',has_more);
END $$;
CREATE OR REPLACE FUNCTION public.crm_note_save(p_request uuid,p_id uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.note_profile(); details jsonb:=p_payload->'details'; note jsonb; idx bigint; amount numeric; total numeric:=0;
 command jsonb; previous crm_backend.promissory_notes%ROWTYPE; prior crm_backend.promissory_requests%ROWTYPE; saved crm_backend.promissory_notes%ROWTYPE; result jsonb;
BEGIN
 IF p_request IS NULL OR p_id IS NULL OR p_revision IS NULL OR p_revision<0 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR octet_length(p_payload::text)>300000 OR jsonb_typeof(details) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_payload->'notes') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'financing') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'note_invalid'; END IF;
 IF jsonb_array_length(p_payload->'notes') NOT BETWEEN 1 AND 360
 OR length(btrim(coalesce(details->>'creditor','')))=0 OR length(btrim(coalesce(details->>'issuerName','')))=0
 OR length(btrim(coalesce(details->>'address','')))=0 OR length(btrim(coalesce(details->>'issuePlace','')))=0
 OR coalesce(details->>'issuerId','') !~ '^[0-9]{10,11}$' OR coalesce(details->>'issuedOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'note_invalid'; END IF;
 BEGIN PERFORM (details->>'issuedOn')::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'note_invalid'; END;
 FOR note,idx IN SELECT value,ordinality FROM jsonb_array_elements(p_payload->'notes') WITH ORDINALITY LOOP
  IF jsonb_typeof(note)<>'object' OR jsonb_typeof(note->'cents') IS DISTINCT FROM 'number' OR coalesce(note->>'number','')<>idx::text
  OR coalesce(note->>'dueDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'note_invalid'; END IF;
  amount:=(note->>'cents')::numeric;
  IF amount<=0 OR amount>99999999999999 OR amount<>round(amount) THEN RAISE EXCEPTION 'note_invalid'; END IF;
  total:=total+amount;
  IF total>99999999999999 THEN RAISE EXCEPTION 'note_invalid'; END IF;
  BEGIN IF (note->>'dueDate')::date<(details->>'issuedOn')::date THEN RAISE EXCEPTION 'note_invalid'; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'note_invalid'; END;
 END LOOP;
 command:=jsonb_build_object('id',p_id,'revision',p_revision,'payload',p_payload);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_request::text,2));
 SELECT * INTO prior FROM crm_backend.promissory_requests WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF prior.command<>command THEN RAISE EXCEPTION 'note_conflict'; END IF; RETURN prior.result; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,3));
 SELECT * INTO previous FROM crm_backend.promissory_notes WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF previous.company_name<>p->>'company_name' THEN RAISE EXCEPTION 'note_forbidden'; END IF;
  IF previous.revision<>p_revision THEN RAISE EXCEPTION 'note_conflict'; END IF;
  UPDATE crm_backend.promissory_notes SET payload=p_payload,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO saved;
 ELSE
  IF p_revision<>0 THEN RAISE EXCEPTION 'note_conflict'; END IF;
  INSERT INTO crm_backend.promissory_notes(id,company_name,payload,revision,created_by) VALUES(p_id,p->>'company_name',p_payload,1,auth.uid()) RETURNING * INTO saved;
 END IF;
 result:=jsonb_build_object('id',saved.id,'payload',saved.payload,'revision',saved.revision,'updated_at',saved.updated_at);
 INSERT INTO crm_backend.promissory_requests(actor,request_id,command,result) VALUES(auth.uid(),p_request,command,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_note_list(text),public.crm_note_save(uuid,uuid,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_note_list(text),public.crm_note_save(uuid,uuid,bigint,jsonb) TO authenticated;

-- Public deployment health contains schema/module names only, never customer or staff data.
CREATE OR REPLACE FUNCTION public.crm_server_readiness() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE missing jsonb:='[]'; signature text; module_name text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
 'public.crm_get_my_profile()','public.crm_staff_directory()','public.crm_manage_staff(text,jsonb,boolean)',
 'public.crm_backend_list(text,text,integer)','public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean)',
 'public.crm_file_list(text,integer)','public.crm_can_read_object(text)','public.crm_can_upload_object(text)',
 'public.crm_office_context()','public.crm_office_assign(text,boolean)','public.crm_office_list(text,text)','public.crm_office_save(uuid,uuid,text,bigint,jsonb)',
 'public.crm_note_list(text)','public.crm_note_save(uuid,uuid,bigint,jsonb)'
 ] LOOP IF pg_catalog.to_regprocedure(signature) IS NULL THEN missing:=missing||jsonb_build_array(signature); END IF; END LOOP;
 FOREACH module_name IN ARRAY ARRAY['projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves'] LOOP
  IF NOT EXISTS(SELECT 1 FROM crm_backend.module_settings WHERE module=module_name AND write_enabled) THEN missing:=missing||jsonb_build_array('module:'||module_name); END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='crm-private' AND NOT public) THEN missing:=missing||'"private_storage"'::jsonb; END IF;
 RETURN jsonb_build_object('version',20261116205202::bigint,'ready',jsonb_array_length(missing)=0,'missing',missing);
END $$;
REVOKE ALL ON FUNCTION public.crm_server_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_server_readiness() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

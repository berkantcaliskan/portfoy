BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('crm-private','crm-private',false,20971520)
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='crm-private' AND public)
 THEN RAISE EXCEPTION 'crm_private_bucket_required'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_backend.file_downloads (
 request_id uuid PRIMARY KEY, file_id text NOT NULL, actor uuid NOT NULL REFERENCES auth.users(id),
 actor_name text NOT NULL, downloaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_file_download_record ON crm_backend.file_downloads(file_id,downloaded_at);
ALTER TABLE crm_backend.file_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.file_downloads FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_backend.file_visible(p jsonb,owner_id text,body jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN owner_id=p->>'id' THEN true
 WHEN body->>'shareTarget'='MEMBERS' THEN coalesce(body->'targetMemberIds','[]') ? (p->>'id')
 WHEN p->>'role'='ADMIN' THEN true
 WHEN body->'permissions'->>'canView'='false' THEN false
 WHEN body->>'shareTarget'='ALL_TEAM' THEN true
 WHEN body->>'shareTarget'='MANAGEMENT' THEN p->>'department'='Yönetim' OR p->>'role'='MANAGER'
 WHEN body->>'shareTarget'='DEPARTMENTS' THEN coalesce(body->'targetDepartments','[]') ? (p->>'department')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p->'departments','[]')) d WHERE coalesce(body->'targetDepartments','[]') ? d)
 ELSE false END
$$;
REVOKE ALL ON FUNCTION crm_backend.file_visible(jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_file_list(p_after text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
 IF p_after IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') INTO result FROM (
 SELECT id,payload || jsonb_build_object(
 'downloadCount',(SELECT count(*) FROM crm_backend.file_downloads d WHERE d.file_id=records.id),
 'downloadsAudit',(SELECT coalesce(jsonb_agg(x),'[]') FROM (
   SELECT actor::text AS "userId",actor_name AS "userName",downloaded_at AS "downloadedAt"
   FROM crm_backend.file_downloads d WHERE d.file_id=records.id ORDER BY downloaded_at DESC LIMIT 20
 ) x)) AS payload,revision,owner_id,department,created_at,updated_at FROM crm_backend.records
 WHERE module='files' AND NOT deleted AND company_name=coalesce(p->>'company_name','') AND id>p_after
 AND crm_backend.file_visible(p,owner_id,payload) ORDER BY id LIMIT p_limit+1
 ) r;
 RETURN jsonb_build_object('records',result,'has_more',jsonb_array_length(result)>p_limit);
END $$;
REVOKE ALL ON FUNCTION public.crm_file_list(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_file_list(text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_can_read_object(p_path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb;
BEGIN
 p:=public.crm_get_my_profile();
 IF coalesce((p->>'must_change_password')::boolean,false) THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM crm_backend.records WHERE module='files' AND NOT deleted
 AND company_name=coalesce(p->>'company_name','') AND payload->>'storagePath'=p_path
 AND crm_backend.file_visible(p,owner_id,payload));
END $$;
REVOKE ALL ON FUNCTION public.crm_can_read_object(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_read_object(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_can_upload_object(p_path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile();
BEGIN
 RETURN split_part(p_path,'/',1)=auth.uid()::text AND NOT coalesce((p->>'must_change_password')::boolean,false);
END $$;
REVOKE ALL ON FUNCTION public.crm_can_upload_object(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_upload_object(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_log_file_download(p_id text,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); r crm_backend.records%ROWTYPE;
BEGIN
 SELECT * INTO r FROM crm_backend.records WHERE module='files' AND id=p_id AND NOT deleted AND company_name=coalesce(p->>'company_name','');
 IF NOT FOUND OR NOT crm_backend.file_visible(p,r.owner_id,r.payload) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF EXISTS(SELECT 1 FROM crm_backend.file_downloads WHERE request_id=p_request AND (actor<>auth.uid() OR file_id<>p_id))
 THEN RAISE EXCEPTION 'crm_request_conflict'; END IF;
 INSERT INTO crm_backend.file_downloads(request_id,file_id,actor,actor_name)
 VALUES(p_request,p_id,auth.uid(),p->>'full_name') ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.crm_log_file_download(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_log_file_download(text,uuid) TO authenticated;

DROP POLICY IF EXISTS crm_private_insert ON storage.objects;
CREATE POLICY crm_private_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='crm-private' AND public.crm_can_upload_object(name));
DROP POLICY IF EXISTS crm_private_read ON storage.objects;
CREATE POLICY crm_private_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='crm-private' AND public.crm_can_read_object(name));

CREATE OR REPLACE FUNCTION crm_backend.validate_file() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous crm_backend.records%ROWTYPE; p jsonb;
BEGIN
 IF NEW.module<>'files' THEN RETURN NEW; END IF;
 p:=public.crm_get_my_profile();
 SELECT * INTO previous FROM crm_backend.records WHERE module='files' AND id=NEW.id;
 IF FOUND AND previous.payload->>'shareTarget'='MEMBERS'
 AND NOT crm_backend.file_visible(p,previous.owner_id,previous.payload)
 THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF NEW.deleted THEN RETURN NEW; END IF;
 IF length(btrim(coalesce(NEW.payload->>'name',''))) NOT BETWEEN 1 AND 255
 OR coalesce(NEW.payload->>'shareTarget','') NOT IN ('ALL_TEAM','DEPARTMENTS','MEMBERS','MANAGEMENT')
 OR NEW.payload ? 'fileDataUrl' OR octet_length(NEW.payload::text)>65536
 OR jsonb_typeof(coalesce(NEW.payload->'targetDepartments','[]'))<>'array'
 OR jsonb_typeof(coalesce(NEW.payload->'targetMemberIds','[]'))<>'array'
 OR jsonb_typeof(NEW.payload->'permissions') IS DISTINCT FROM 'object'
 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='crm-private' AND name=NEW.payload->>'storagePath')
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF NEW.payload->>'shareTarget'='MEMBERS' AND jsonb_array_length(coalesce(NEW.payload->'targetMemberIds','[]'))=0
 OR NEW.payload->>'shareTarget'='DEPARTMENTS' AND jsonb_array_length(coalesce(NEW.payload->'targetDepartments','[]'))=0
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF TG_OP='INSERT' AND split_part(NEW.payload->>'storagePath','/',1)<>auth.uid()::text
 AND NOT EXISTS(SELECT 1 FROM crm_backend.records WHERE module='files' AND id=NEW.id AND company_name=NEW.company_name AND payload->>'storagePath'=NEW.payload->>'storagePath')
 THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF TG_OP='UPDATE' AND OLD.payload->>'storagePath' IS DISTINCT FROM NEW.payload->>'storagePath'
 THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 NEW.payload:=NEW.payload || jsonb_build_object('uploadedByUserId',NEW.owner_id,'createdAt',NEW.created_at,'updatedAt',NEW.updated_at,
 'uploadedByUserName',(SELECT full_name FROM public.app_users WHERE id=NEW.owner_id));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_file() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_file ON crm_backend.records;
CREATE TRIGGER crm_validate_file BEFORE INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_file();
CREATE OR REPLACE FUNCTION public.crm_backend_list(p_module text,p_after text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; result jsonb;
BEGIN
 profile:=public.crm_get_my_profile();
 IF p_module='files' THEN RETURN public.crm_file_list(p_after,p_limit); END IF;
 IF p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files')
 OR p_after IS NULL OR length(p_after)>200 OR p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) INTO result
 FROM (SELECT id,payload,revision,owner_id,department,created_at,updated_at FROM crm_backend.records
 WHERE module=p_module AND company_name=coalesce(profile->>'company_name','') AND NOT deleted AND id>p_after
 AND crm_backend.can_access(profile,module,owner_id,department,false) ORDER BY id LIMIT p_limit+1) r;
 RETURN jsonb_build_object('records',result,'has_more',jsonb_array_length(result)>p_limit);
END $$;
REVOKE ALL ON FUNCTION public.crm_backend_list(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_backend_list(text,text,integer) TO authenticated;


COMMIT;

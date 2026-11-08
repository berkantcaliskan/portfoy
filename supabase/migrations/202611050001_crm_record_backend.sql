-- Eklemeli genel backend temeli. Meta tabloları/işlevleri/politikaları değişmez.
-- Önkoşul: 202611040001_crm_identity_foundation.sql. İstemci geçişini açmaz.
BEGIN;
CREATE SCHEMA IF NOT EXISTS crm_backend;
REVOKE ALL ON SCHEMA crm_backend FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS crm_backend.module_settings (
 module text PRIMARY KEY,
 write_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO crm_backend.module_settings(module) SELECT unnest(ARRAY['projects','appointments','requests','collections','payments','approvals','files']) ON CONFLICT DO NOTHING;
ALTER TABLE crm_backend.module_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS crm_backend.records (
 module text NOT NULL CHECK(module IN ('projects','appointments','requests','collections','payments','approvals','files')),
 id text NOT NULL CHECK(length(id) BETWEEN 1 AND 200),
 company_name text NOT NULL,
 owner_id text NOT NULL REFERENCES public.app_users(id),
 department text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 revision bigint NOT NULL CHECK(revision>0),
 deleted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(module,id)
);
CREATE TABLE IF NOT EXISTS crm_backend.write_audit (
 request_id uuid PRIMARY KEY,
 actor uuid NOT NULL REFERENCES auth.users(id),
 module text NOT NULL,
 record_id text NOT NULL,
 operation text NOT NULL CHECK(operation IN ('save','archive')),
 payload_hash text NOT NULL,
 revision bigint NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_backend.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.write_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA crm_backend FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA crm_backend TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA crm_backend TO service_role;
CREATE INDEX IF NOT EXISTS crm_records_company_module ON crm_backend.records(company_name,module,id);
CREATE INDEX IF NOT EXISTS crm_write_actor_time ON crm_backend.write_audit(actor,recorded_at);

-- Profil sadece sunucudaki etkin Auth/personel eşlemesinden gelir.
CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
 WHEN m NOT IN ('projects','appointments','requests','collections','payments','approvals','files') THEN false
 WHEN p->>'role'='ADMIN' THEN true
 WHEN m IN ('collections','payments') THEN p->>'department'='Muhasebe'
 WHEN m='projects' THEN NOT writing OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim'))
 WHEN m='files' THEN owner_id=p->>'id'
 WHEN m='approvals' THEN owner_id=p->>'id' OR (p->>'role'='MANAGER' AND p->>'department'='Yönetim')
 ELSE owner_id=p->>'id' OR (p->>'scope'='DEPARTMENT' AND p->>'role'='MANAGER' AND dept=p->>'department')
 END
$$;
REVOKE ALL ON FUNCTION crm_backend.can_access(jsonb,text,text,text,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_backend_list(p_module text,p_after text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; result jsonb;
BEGIN
 profile:=public.crm_get_my_profile();
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

CREATE OR REPLACE FUNCTION public.crm_backend_write(p_request uuid,p_module text,p_id text,p_revision bigint,p_payload jsonb,p_archive boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; previous crm_backend.records%ROWTYPE; audit crm_backend.write_audit%ROWTYPE;
 stamp timestamptz:=clock_timestamp(); next_revision bigint; digest text; operation text;
BEGIN
 profile:=public.crm_get_my_profile();
 IF p_request IS NULL OR p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files')
 OR p_id IS NULL OR length(p_id) NOT BETWEEN 1 AND 200 OR p_revision IS NULL OR p_revision<0 OR p_archive IS NULL
 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>2097152
 OR (NOT p_archive AND p_payload->>'id' IS DISTINCT FROM p_id)
 THEN RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023'; END IF;
 operation:=CASE WHEN p_archive THEN 'archive' ELSE 'save' END;
 IF NOT EXISTS(SELECT 1 FROM crm_backend.module_settings WHERE module=p_module AND write_enabled)
 THEN RAISE EXCEPTION 'crm_module_not_activated' USING ERRCODE='55000'; END IF;
 digest:=encode(sha256(convert_to(jsonb_build_object('module',p_module,'id',p_id,'revision',p_revision,'payload',p_payload,'operation',operation)::text,'UTF8')),'hex');
 -- Aynı request ve aynı kayıt eşzamanlı iki istemcide tek kez işlenir.
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_request:'||p_request::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_actor:'||auth.uid()::text,0));
 SELECT * INTO audit FROM crm_backend.write_audit WHERE request_id=p_request;
 IF FOUND THEN
  IF audit.actor<>auth.uid() OR audit.payload_hash<>digest THEN RAISE EXCEPTION 'crm_request_conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',audit.record_id,'revision',audit.revision,'updated_at',audit.recorded_at,'replayed',true);
 END IF;
 IF (SELECT count(*) FROM crm_backend.write_audit WHERE actor=auth.uid() AND recorded_at>stamp-interval '1 minute')>=120
 THEN RAISE EXCEPTION 'crm_rate_limited' USING ERRCODE='54000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_record:'||p_module||':'||p_id,0));
 SELECT * INTO previous FROM crm_backend.records WHERE module=p_module AND id=p_id FOR UPDATE;
 IF FOUND THEN
  IF previous.company_name<>coalesce(profile->>'company_name','') OR NOT crm_backend.can_access(profile,p_module,previous.owner_id,previous.department,true)
  THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  IF previous.deleted OR previous.revision<>p_revision THEN RAISE EXCEPTION 'crm_revision_conflict' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_revision<>0 OR p_archive THEN RAISE EXCEPTION 'crm_revision_conflict' USING ERRCODE='40001'; END IF;
  IF NOT crm_backend.can_access(profile,p_module,profile->>'id',profile->>'department',true)
  THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 -- Genel belge katmanı onay kararı veremez; onay incelemesi ayrı iş RPC'si gerektirir.
 IF p_module='approvals' AND NOT p_archive AND coalesce(p_payload->>'status','BEKLEMEDE')<>'BEKLEMEDE'
 THEN RAISE EXCEPTION 'crm_approval_workflow_required' USING ERRCODE='42501'; END IF;
 next_revision:=coalesce(previous.revision,0)+1;
 INSERT INTO crm_backend.records(module,id,company_name,owner_id,department,payload,revision,deleted,updated_at)
 VALUES(p_module,p_id,coalesce(profile->>'company_name',''),profile->>'id',profile->>'department',p_payload,next_revision,p_archive,stamp)
 ON CONFLICT(module,id) DO UPDATE SET payload=CASE WHEN p_archive THEN crm_backend.records.payload ELSE excluded.payload END,
 revision=excluded.revision,deleted=excluded.deleted,updated_at=excluded.updated_at;
 INSERT INTO crm_backend.write_audit(request_id,actor,module,record_id,operation,payload_hash,revision,recorded_at)
 VALUES(p_request,auth.uid(),p_module,p_id,operation,digest,next_revision,stamp);
 RETURN jsonb_build_object('id',p_id,'revision',next_revision,'updated_at',stamp,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) TO authenticated;
COMMIT;

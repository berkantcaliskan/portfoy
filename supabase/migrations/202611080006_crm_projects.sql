BEGIN;
CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN m NOT IN ('projects','appointments','requests','collections','payments','approvals','files') THEN false
 WHEN p->>'role'='ADMIN' THEN true
 WHEN m IN ('collections','payments') THEN p->>'department'='Muhasebe'
 WHEN m='projects' THEN NOT writing OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim')) OR p->'permissions'->>'canChangeFlatStatus'='true' OR p->'permissions'->>'canEditProjectPrice'='true'
 WHEN m='files' THEN owner_id=p->>'id'
 WHEN m='approvals' THEN owner_id=p->>'id' OR (p->>'role'='MANAGER' AND p->>'department'='Yönetim')
 ELSE owner_id=p->>'id' OR (p->>'scope'='DEPARTMENT' AND p->>'role'='MANAGER' AND dept=p->>'department')
 END,false)
$$;
REVOKE ALL ON FUNCTION crm_backend.can_access(jsonb,text,text,text,boolean) FROM PUBLIC,anon,authenticated;


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
  RETURN jsonb_build_object('id',audit.record_id,'revision',audit.revision,'updated_at',audit.recorded_at,'replayed',true,'payload',(SELECT payload FROM crm_backend.records WHERE module=audit.module AND id=audit.record_id AND revision=audit.revision));
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
 RETURN jsonb_build_object('id',p_id,'revision',next_revision,'updated_at',stamp,'replayed',false,'payload',(SELECT payload FROM crm_backend.records WHERE module=p_module AND id=p_id));
END $$;
REVOKE ALL ON FUNCTION public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.validate_project() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); prior jsonb; unit jsonb; old_unit jsonb; units jsonb:='[]';
 layout_allowed boolean:=p->>'role'='ADMIN' OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim'));
 status_allowed boolean:=p->>'role'='ADMIN' OR p->'permissions'->>'canChangeFlatStatus'='true';
 price_allowed boolean:=p->>'role'='ADMIN' OR p->'permissions'->>'canEditProjectPrice'='true';
BEGIN
 IF NEW.module<>'projects' THEN RETURN NEW; END IF;
 SELECT payload INTO prior FROM crm_backend.records WHERE module='projects' AND id=NEW.id;
 IF NEW.deleted THEN
  IF NOT coalesce(layout_allowed,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  RETURN NEW;
 END IF;
 IF length(btrim(coalesce(NEW.payload->>'name',''))) NOT BETWEEN 1 AND 200
 OR jsonb_typeof(NEW.payload->'units') IS DISTINCT FROM 'array'
 OR jsonb_array_length(NEW.payload->'units')>5000
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF prior IS NULL AND NOT coalesce(layout_allowed,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF prior IS NOT NULL AND NOT coalesce(layout_allowed,false) AND
 (prior-'units' IS DISTINCT FROM NEW.payload-'units' OR
 (SELECT array_agg(x->>'id' ORDER BY x->>'id') FROM jsonb_array_elements(prior->'units') x)
 IS DISTINCT FROM (SELECT array_agg(x->>'id' ORDER BY x->>'id') FROM jsonb_array_elements(NEW.payload->'units') x))
 THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'id') FROM jsonb_array_elements(NEW.payload->'units') x) THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 FOR unit IN SELECT value FROM jsonb_array_elements(NEW.payload->'units') LOOP
  IF length(coalesce(unit->>'id','')) NOT BETWEEN 1 AND 200 OR coalesce(unit->>'status','') NOT IN ('SATISTA','REZERVE','SATILDI')
  OR jsonb_typeof(unit->'price') IS DISTINCT FROM 'number' OR (unit->>'price')::numeric NOT BETWEEN 0 AND 999999999999.99
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  SELECT value INTO old_unit FROM jsonb_array_elements(coalesce(prior->'units','[]')) WHERE value->>'id'=unit->>'id';
  IF old_unit IS NOT NULL THEN
   IF NOT coalesce(layout_allowed,false) AND (unit-ARRAY['status','statusLabel','price','reservation','sale','history']) IS DISTINCT FROM (old_unit-ARRAY['status','statusLabel','price','reservation','sale','history'])
   THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   IF unit->'price' IS DISTINCT FROM old_unit->'price' AND NOT coalesce(price_allowed,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   IF unit->'status' IS DISTINCT FROM old_unit->'status' THEN
    IF NOT coalesce(status_allowed,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
    IF old_unit->>'status'='SATILDI' AND p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
    IF old_unit->>'status'='REZERVE' AND old_unit->'reservation'->>'reservedByUserId' IS DISTINCT FROM p->>'id' AND p->>'role' NOT IN ('ADMIN','MANAGER') THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
    IF unit->>'status'='REZERVE' THEN
     IF length(btrim(coalesce(unit->'reservation'->>'customerName','')))<1 OR coalesce((unit->'reservation'->>'expiresAt')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp() THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
     unit:=jsonb_set(unit,'{reservation}',unit->'reservation'||jsonb_build_object('reservedByUserId',p->>'id','reservedByUserName',p->>'full_name','reservedAt',clock_timestamp()));
    ELSIF unit->>'status'='SATILDI' THEN
     IF length(btrim(coalesce(unit->'sale'->>'customerName','')))<1 OR jsonb_typeof(unit->'sale'->'salePrice') IS DISTINCT FROM 'number' OR (unit->'sale'->>'salePrice')::numeric<=0 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
     unit:=jsonb_set(unit,'{sale}',unit->'sale'||jsonb_build_object('soldByUserId',p->>'id','soldByUserName',p->>'full_name','soldAt',clock_timestamp()));
    END IF;
    unit:=jsonb_set(unit,'{history}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'fromStatus',old_unit->>'status','toStatus',unit->>'status','changedByUserId',p->>'id','changedByUserName',p->>'full_name','changedAt',clock_timestamp(),'reason','Sunucuda doğrulanan aşama değişikliği'))||coalesce(old_unit->'history','[]'));
   ELSE
    IF unit->'sale' IS DISTINCT FROM old_unit->'sale' OR unit->'reservation' IS DISTINCT FROM old_unit->'reservation' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
    unit:=jsonb_set(unit,'{history}',coalesce(old_unit->'history','[]'));
   END IF;
  END IF;
  units:=units||jsonb_build_array(unit);
 END LOOP;
 NEW.payload:=jsonb_set(NEW.payload,'{units}',units);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_project() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_project ON crm_backend.records;
CREATE TRIGGER crm_validate_project BEFORE INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_project();

COMMIT;

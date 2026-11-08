BEGIN;
ALTER TABLE crm_backend.records DROP CONSTRAINT IF EXISTS records_module_check;
ALTER TABLE crm_backend.records ADD CONSTRAINT records_module_check CHECK(module IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves'));
INSERT INTO crm_backend.module_settings(module) SELECT unnest(ARRAY['team_presence','team_assets','team_leaves']) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN m NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves') THEN false
 WHEN p->>'role'='ADMIN' THEN true
 WHEN m IN ('collections','payments') THEN p->>'department'='Muhasebe'
 WHEN m='projects' THEN NOT writing OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim')) OR p->'permissions'->>'canChangeFlatStatus'='true' OR p->'permissions'->>'canEditProjectPrice'='true'
 WHEN m='team_assets' THEN true
 WHEN m='team_presence' THEN true
 WHEN m='team_leaves' THEN owner_id=p->>'id' OR (p->>'role'='MANAGER' AND dept=p->>'department')
 WHEN m='calendar' THEN owner_id=p->>'id'
 WHEN m='calendar_overrides' THEN owner_id=p->>'id'
 WHEN m='messages' THEN owner_id=p->>'id'
 WHEN m='brand_kit' THEN NOT writing OR p->>'department' IN ('Kreatif','Pazarlama','Yönetim')
 WHEN m='contacts' THEN owner_id=p->>'id'
 WHEN m='properties' THEN NOT writing OR owner_id=p->>'id' OR (p->>'role'='MANAGER' AND p->>'department'='Satış')
 WHEN m IN ('creative_schedule','creative_assets','creative_comments','creative_briefs') THEN
   p->>'department' IN ('Kreatif','Pazarlama','Yönetim') OR (owner_id=p->>'id' AND m IN ('creative_briefs','creative_comments'))
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
 IF p_request IS NULL OR p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves')
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

CREATE OR REPLACE FUNCTION public.crm_backend_list(p_module text,p_after text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; result jsonb;
BEGIN
 profile:=public.crm_get_my_profile();
 IF p_module='files' THEN RETURN public.crm_file_list(p_after,p_limit); END IF;
 IF p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages','team_presence','team_assets','team_leaves')
 OR p_after IS NULL OR length(p_after)>200 OR p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) INTO result
 FROM (SELECT id,payload,revision,owner_id,department,created_at,updated_at FROM crm_backend.records
 WHERE module=p_module AND company_name=coalesce(profile->>'company_name','') AND NOT deleted AND id>p_after
 AND crm_backend.record_visible(profile,module,owner_id,department,payload) ORDER BY id LIMIT p_limit+1) r;
 RETURN jsonb_build_object('records',result,'has_more',jsonb_array_length(result)>p_limit);
END $$;
REVOKE ALL ON FUNCTION public.crm_backend_list(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_backend_list(text,text,integer) TO authenticated;





CREATE OR REPLACE FUNCTION crm_backend.validate_team_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); prior jsonb; existing crm_backend.records%ROWTYPE; managed boolean:=p->>'role'='ADMIN' OR (p->>'role'='MANAGER' AND p->>'department'='Yönetim'); action text; target public.app_users%ROWTYPE;
BEGIN
 IF NEW.module NOT IN ('team_presence','team_assets','team_leaves') THEN RETURN NEW; END IF;
 SELECT * INTO existing FROM crm_backend.records WHERE module=NEW.module AND id=NEW.id;
 prior:=existing.payload;
 IF FOUND THEN NEW.owner_id:=existing.owner_id;NEW.department:=existing.department;NEW.created_at:=existing.created_at;END IF;
 IF NEW.module='team_assets' THEN
  IF NEW.deleted THEN IF NOT coalesce(managed,false) OR prior->>'holderUserId' IS NOT NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF; RETURN NEW; END IF;
  IF length(btrim(coalesce(NEW.payload->>'name',''))) NOT BETWEEN 1 AND 250 OR coalesce(NEW.payload->>'category','') NOT IN ('ARAC','PORTFOY_ANAHTARI','EKIPMAN') THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF prior IS NULL THEN
   IF NOT coalesce(managed,false) OR NEW.payload->>'holderUserId' IS NOT NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   NEW.payload:=NEW.payload||jsonb_build_object('history','[]'::jsonb);
  ELSE
   IF NOT coalesce(managed,false) AND (NEW.payload-ARRAY['holderUserId','holderUserName','takenAt','destinationNote','expectedReturnTime','history','updatedAt','autoPresenceStatus']) IS DISTINCT FROM (prior-ARRAY['holderUserId','holderUserName','takenAt','destinationNote','expectedReturnTime','history','updatedAt','autoPresenceStatus']) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   IF NEW.payload->>'holderUserId' IS DISTINCT FROM prior->>'holderUserId' THEN
    IF prior->>'holderUserId' IS NULL AND NEW.payload->>'holderUserId'=p->>'id' THEN
     action:='TESLIM_ALINDI';NEW.payload:=NEW.payload||jsonb_build_object('holderUserName',p->>'full_name','takenAt',clock_timestamp());
    ELSIF NEW.payload->>'holderUserId' IS NULL AND (prior->>'holderUserId'=p->>'id' OR coalesce(managed,false)) THEN
     action:='TESLIM_EDILDI';NEW.payload:=NEW.payload||jsonb_build_object('holderUserName',null,'takenAt',null,'destinationNote',null,'expectedReturnTime',null);
    ELSE RAISE EXCEPTION 'crm_forbidden'; END IF;
    NEW.payload:=jsonb_set(NEW.payload,'{history}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'assetId',NEW.id,'assetName',NEW.payload->>'name','assetCode',NEW.payload->>'codeOrPlate','action',action,'userId',p->>'id','userName',p->>'full_name','timestamp',clock_timestamp()))||coalesce(prior->'history','[]'));
   ELSE
    IF NOT coalesce(managed,false) AND prior->>'holderUserId' IS DISTINCT FROM p->>'id' AND (NEW.payload-ARRAY['history','updatedAt','autoPresenceStatus']) IS DISTINCT FROM (prior-ARRAY['history','updatedAt','autoPresenceStatus']) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
    NEW.payload:=NEW.payload||jsonb_build_object('history',coalesce(prior->'history','[]'),'holderUserName',prior->'holderUserName','takenAt',prior->'takenAt');
   END IF;
  END IF;
 ELSIF NEW.module='team_presence' THEN
  SELECT * INTO target FROM public.app_users WHERE id=NEW.id AND company_name=NEW.company_name;
  IF NOT FOUND OR (target.id<>p->>'id' AND p->>'role'<>'ADMIN' AND NOT(p->>'role'='MANAGER' AND target.department=p->>'department')) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF coalesce(NEW.payload->>'status','') NOT IN ('OFISTE','GOSTERIMDE','TAPUDA','SANTIYEDE','TOPLANTIDA','MOLADA','IZINLI','MESAI_DISI') THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  NEW.payload:=NEW.payload||jsonb_build_object('userId',target.id,'updatedBy',p->>'id');
 ELSIF NEW.module='team_leaves' THEN
  IF NEW.deleted THEN IF prior->>'status'<>'BEKLEMEDE' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;RETURN NEW;END IF;
  IF coalesce(NEW.payload->>'leaveType','') NOT IN ('SAATLIK_CIKIS','YILLIK_IZIN','MAZERET_IZNI','RAPOR') OR length(btrim(coalesce(NEW.payload->>'reason',''))) NOT BETWEEN 1 AND 4000 OR coalesce(NEW.payload->>'status','') NOT IN ('BEKLEMEDE','ONAYLANDI','REDDEDILDI') OR (NEW.payload->>'startDate')::date>(NEW.payload->>'endDate')::date OR coalesce(NEW.payload->>'startDate','')='' OR coalesce(NEW.payload->>'endDate','')='' THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF prior IS NULL AND NEW.payload->>'status'<>'BEKLEMEDE' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF prior IS NOT NULL AND NEW.payload->>'status' IS DISTINCT FROM prior->>'status' THEN
   IF prior->>'status'<>'BEKLEMEDE' OR (p->>'role'<>'ADMIN' AND NOT(p->>'role'='MANAGER' AND NEW.department=p->>'department' AND NEW.owner_id<>p->>'id')) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   IF (NEW.payload-ARRAY['status','reviewedBy','reviewedAt','reviewNote','updatedAt']) IS DISTINCT FROM (prior-ARRAY['status','reviewedBy','reviewedAt','reviewNote','updatedAt']) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
   NEW.payload:=NEW.payload||jsonb_build_object('reviewedBy',p->>'full_name','reviewedAt',clock_timestamp());
  ELSIF prior IS NOT NULL AND prior->>'status'<>'BEKLEMEDE' THEN RAISE EXCEPTION 'crm_forbidden';
  ELSE NEW.payload:=NEW.payload-ARRAY['reviewedBy','reviewedAt','reviewNote']; END IF;
  NEW.payload:=NEW.payload||jsonb_build_object('userId',NEW.owner_id,'userName',(SELECT full_name FROM public.app_users WHERE id=NEW.owner_id),'userDepartment',NEW.department);
 END IF;
 NEW.payload:=NEW.payload||jsonb_build_object('createdAt',NEW.created_at,'updatedAt',NEW.updated_at);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_team_record() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_team_record ON crm_backend.records;
CREATE TRIGGER crm_validate_team_record BEFORE INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_team_record();

CREATE OR REPLACE FUNCTION crm_backend.team_workflow() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target_id text; target_dept text; next_status text; note text; return_time text; prior crm_backend.records%ROWTYPE; body jsonb;
BEGIN
 IF NEW.deleted THEN RETURN NEW; END IF;
 IF NEW.module='team_assets' AND TG_OP='UPDATE' AND OLD.payload->>'holderUserId' IS NULL AND NEW.payload->>'holderUserId' IS NOT NULL AND NEW.payload->>'autoPresenceStatus' IS NOT NULL THEN
  target_id:=NEW.payload->>'holderUserId';next_status:=NEW.payload->>'autoPresenceStatus';note:=coalesce(NEW.payload->>'destinationNote','');return_time:=coalesce(NEW.payload->>'expectedReturnTime','');
 ELSIF NEW.module='team_leaves' AND TG_OP='UPDATE' AND OLD.payload->>'status'='BEKLEMEDE' AND NEW.payload->>'status'='ONAYLANDI'
 AND (clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date BETWEEN (NEW.payload->>'startDate')::date AND (NEW.payload->>'endDate')::date THEN
  target_id:=NEW.owner_id;next_status:='IZINLI';note:=NEW.payload->>'reason';return_time:=coalesce(NEW.payload->>'endTime','');
 ELSE RETURN NEW; END IF;
 SELECT department INTO target_dept FROM public.app_users WHERE id=target_id AND company_name=NEW.company_name;
 IF target_dept IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_record:team_presence:'||target_id,0));
 SELECT * INTO prior FROM crm_backend.records WHERE module='team_presence' AND id=target_id FOR UPDATE;
 body:=jsonb_build_object('id',target_id,'userId',target_id,'status',next_status,'locationNote',note,'returnTime',return_time,'updatedBy',public.crm_get_my_profile()->>'id','updatedAt',clock_timestamp());
 INSERT INTO crm_backend.records(module,id,company_name,owner_id,department,payload,revision,updated_at)
 VALUES('team_presence',target_id,NEW.company_name,target_id,target_dept,body,coalesce(prior.revision,0)+1,clock_timestamp())
 ON CONFLICT(module,id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.team_workflow() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_team_workflow ON crm_backend.records;
CREATE TRIGGER crm_team_workflow AFTER INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.team_workflow();
COMMIT;

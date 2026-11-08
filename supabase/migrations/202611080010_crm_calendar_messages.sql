BEGIN;
ALTER TABLE crm_backend.records DROP CONSTRAINT IF EXISTS records_module_check;
ALTER TABLE crm_backend.records ADD CONSTRAINT records_module_check CHECK(module IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages'));
INSERT INTO crm_backend.module_settings(module) SELECT unnest(ARRAY['calendar','calendar_overrides','brand_kit','messages']) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN m NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages') THEN false
 WHEN p->>'role'='ADMIN' THEN true
 WHEN m IN ('collections','payments') THEN p->>'department'='Muhasebe'
 WHEN m='projects' THEN NOT writing OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim')) OR p->'permissions'->>'canChangeFlatStatus'='true' OR p->'permissions'->>'canEditProjectPrice'='true'
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
 IF p_request IS NULL OR p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages')
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

CREATE OR REPLACE FUNCTION crm_backend.record_visible(p jsonb,m text,owner_id text,dept text,body jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN m='messages' THEN owner_id=p->>'id' OR body->>'recipientId'=p->>'id'
 WHEN m='calendar' THEN owner_id=p->>'id' OR body->>'visibilityScope'='COMPANY'
 OR (body->>'visibilityScope'='USERS' AND coalesce(body->'sharedUserIds','[]') ? (p->>'id'))
 OR (body->>'visibilityScope'='DEPARTMENT' AND coalesce(body->'sharedDepartments','[]') ? (p->>'department'))
 ELSE crm_backend.can_access(p,m,owner_id,dept,false) END,false)
$$;
REVOKE ALL ON FUNCTION crm_backend.record_visible(jsonb,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.crm_backend_list(p_module text,p_after text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; result jsonb;
BEGIN
 profile:=public.crm_get_my_profile();
 IF p_module='files' THEN RETURN public.crm_file_list(p_after,p_limit); END IF;
 IF p_module IS NULL OR p_module NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages')
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




CREATE OR REPLACE FUNCTION crm_backend.validate_workspace_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); sender text; recipient text;
BEGIN
 IF NEW.deleted OR NEW.module NOT IN ('calendar','calendar_overrides','brand_kit','messages') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.module='messages' THEN
  IF OLD.payload->>'recipientId'=p->>'id' AND NEW.payload->>'isRead'='true' AND (NEW.payload-ARRAY['isRead','updatedAt'])=(OLD.payload-ARRAY['isRead','updatedAt']) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'crm_forbidden';
 END IF;
 IF NEW.module='calendar' THEN
  IF length(btrim(coalesce(NEW.payload->>'title',''))) NOT BETWEEN 1 AND 500 OR coalesce(NEW.payload->>'visibilityScope','') NOT IN ('PERSONAL','USERS','DEPARTMENT','COMPANY')
  OR coalesce(NEW.payload->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR coalesce(NEW.payload->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR jsonb_typeof(NEW.payload->'sharedDepartments') IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.payload->'sharedUserIds') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  PERFORM (NEW.payload->>'date')::date;
  NEW.payload:=NEW.payload||jsonb_build_object('createdByUserId',NEW.owner_id,'createdByUserName',(SELECT full_name FROM public.app_users WHERE id=NEW.owner_id),'createdByDepartment',NEW.department,'companyName',NEW.company_name,'autoSource','MANUAL','isAutoSynced',false);
 END IF;
 IF NEW.module='messages' THEN
  sender:=NEW.owner_id; recipient:=NEW.payload->>'recipientId';
  IF recipient=sender OR NOT EXISTS(SELECT 1 FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.id=recipient AND u.company_name=NEW.company_name)
  OR length(coalesce(NEW.payload->>'text',''))>10000 OR (length(btrim(coalesce(NEW.payload->>'text','')))=0 AND NOT NEW.payload ? 'attachmentUrl')
  OR (NEW.payload ? 'attachmentUrl' AND coalesce(NEW.payload->>'attachmentUrl','') !~ '^data:(image/(png|jpeg|gif|webp)|audio/(webm|ogg|mp4)|application/octet-stream)(;codecs=[a-zA-Z0-9.-]+)?;base64,[a-zA-Z0-9+/=]+$')
  OR (NEW.payload ? 'attachmentType' AND coalesce(NEW.payload->>'attachmentType','') NOT IN ('emoji','voice','file','image'))
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  NEW.payload:=NEW.payload||jsonb_build_object('senderId',sender,'senderName',p->>'full_name','conversationId',least(sender,recipient)||'::'||greatest(sender,recipient),'isRead',false);
 END IF;
 NEW.payload:=NEW.payload||jsonb_build_object('createdAt',NEW.created_at,'updatedAt',NEW.updated_at);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_workspace_record() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_workspace_record ON crm_backend.records;
CREATE TRIGGER crm_validate_workspace_record BEFORE INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_workspace_record();

CREATE OR REPLACE FUNCTION public.crm_mark_messages_read(p_peer text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile();
BEGIN
 IF coalesce((p->>'must_change_password')::boolean,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 UPDATE crm_backend.records SET payload=payload||jsonb_build_object('isRead',true),revision=revision+1,updated_at=clock_timestamp()
 WHERE module='messages' AND NOT deleted AND company_name=coalesce(p->>'company_name','') AND owner_id=p_peer AND payload->>'recipientId'=p->>'id' AND payload->>'isRead'='false';
END $$;
REVOKE ALL ON FUNCTION public.crm_mark_messages_read(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_mark_messages_read(text) TO authenticated;
COMMIT;

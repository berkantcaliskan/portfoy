BEGIN;
CREATE OR REPLACE FUNCTION public.crm_file_notes_write(p_request uuid,p_module text,p_id text,p_revision bigint,p_payload jsonb,p_archive boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; previous crm_backend.records%ROWTYPE; audit crm_backend.write_audit%ROWTYPE;
 stamp timestamptz:=clock_timestamp(); next_revision bigint; digest text; operation text;
BEGIN
 profile:=public.crm_get_my_profile();
 IF p_request IS NULL OR p_module IS NULL OR p_module<>'files'
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
  IF previous.company_name<>coalesce(profile->>'company_name','') OR NOT (crm_backend.file_visible(profile,previous.owner_id,previous.payload) AND (previous.owner_id=profile->>'id' OR profile->>'role'='ADMIN' OR previous.payload->'permissions'->>'canEdit'='true'))
  THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  IF previous.deleted OR previous.revision<>p_revision THEN RAISE EXCEPTION 'crm_revision_conflict' USING ERRCODE='40001'; END IF;
 ELSE
  RAISE EXCEPTION 'crm_forbidden';
  IF p_revision<>0 OR p_archive THEN RAISE EXCEPTION 'crm_revision_conflict' USING ERRCODE='40001'; END IF;
  IF NOT crm_backend.can_access(profile,p_module,profile->>'id',profile->>'department',true)
  THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 -- Genel belge katmanı onay kararı veremez; onay incelemesi ayrı iş RPC'si gerektirir.
 IF p_module='approvals' AND NOT p_archive AND coalesce(p_payload->>'status','BEKLEMEDE')<>'BEKLEMEDE'
 THEN RAISE EXCEPTION 'crm_approval_workflow_required' USING ERRCODE='42501'; END IF;
 IF p_archive OR length(coalesce(p_payload->>'notes',''))>10000 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 p_payload:=previous.payload||jsonb_build_object('notes',btrim(coalesce(p_payload->>'notes','')),'folder',btrim(coalesce(p_payload->>'notes','')));
 next_revision:=coalesce(previous.revision,0)+1;
 INSERT INTO crm_backend.records(module,id,company_name,owner_id,department,payload,revision,deleted,updated_at)
 VALUES(p_module,p_id,coalesce(profile->>'company_name',''),profile->>'id',profile->>'department',p_payload,next_revision,p_archive,stamp)
 ON CONFLICT(module,id) DO UPDATE SET payload=CASE WHEN p_archive THEN crm_backend.records.payload ELSE excluded.payload END,
 revision=excluded.revision,deleted=excluded.deleted,updated_at=excluded.updated_at;
 INSERT INTO crm_backend.write_audit(request_id,actor,module,record_id,operation,payload_hash,revision,recorded_at)
 VALUES(p_request,auth.uid(),p_module,p_id,operation,digest,next_revision,stamp);
 RETURN jsonb_build_object('id',p_id,'revision',next_revision,'updated_at',stamp,'replayed',false,'payload',(SELECT payload FROM crm_backend.records WHERE module=p_module AND id=p_id));
END $$;
REVOKE ALL ON FUNCTION public.crm_file_notes_write(uuid,text,text,bigint,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_file_notes_write(uuid,text,text,bigint,jsonb,boolean) TO authenticated;

COMMIT;

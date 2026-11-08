BEGIN;
CREATE OR REPLACE FUNCTION public.crm_decide_approval(
  p_request uuid,p_id text,p_revision bigint,p_decision text,p_notes text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  profile jsonb := public.crm_get_my_profile();
  target crm_backend.records%ROWTYPE;
  attempt crm_backend.write_audit%ROWTYPE;
  digest text;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF coalesce((profile->>'must_change_password')::boolean,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF profile->>'role'<>'ADMIN' AND NOT (profile->>'role'='MANAGER' AND profile->>'department'='Yönetim')
  THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  IF p_request IS NULL OR p_id IS NULL OR length(p_id) NOT BETWEEN 1 AND 200 OR p_revision IS NULL OR p_revision<1
     OR p_decision IS NULL OR p_decision NOT IN ('ONAYLANDI','REDDEDILDI') OR p_notes IS NULL OR length(p_notes)>4000
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF NOT EXISTS(SELECT 1 FROM crm_backend.module_settings WHERE module='approvals' AND write_enabled)
  THEN RAISE EXCEPTION 'crm_module_not_activated'; END IF;
  digest:=encode(sha256(convert_to(jsonb_build_array('approval-decision',p_id,p_revision,p_decision,p_notes)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_request:'||p_request::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_actor:'||auth.uid()::text,0));
  SELECT * INTO attempt FROM crm_backend.write_audit WHERE request_id=p_request;
  IF FOUND THEN
    IF attempt.actor<>auth.uid() OR attempt.payload_hash<>digest THEN RAISE EXCEPTION 'crm_request_conflict'; END IF;
    RETURN jsonb_build_object('id',p_id,'revision',attempt.revision,'updated_at',attempt.recorded_at,'replayed',true);
  END IF;
  IF (SELECT count(*) FROM crm_backend.write_audit WHERE actor=auth.uid() AND recorded_at>stamp-interval '1 minute')>=120
  THEN RAISE EXCEPTION 'crm_rate_limited'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_record:approvals:'||p_id,0));
  SELECT * INTO target FROM crm_backend.records WHERE module='approvals' AND id=p_id FOR UPDATE;
  IF NOT FOUND OR target.company_name<>coalesce(profile->>'company_name','')
  THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF target.deleted OR target.revision<>p_revision OR target.payload->>'status'<>'BEKLEMEDE'
  THEN RAISE EXCEPTION 'crm_revision_conflict'; END IF;
  UPDATE crm_backend.records SET payload=payload || jsonb_build_object(
    'status',p_decision,'reviewNotes',p_notes,'reviewedByUserId',profile->>'id',
    'reviewedByUserName',profile->>'full_name','reviewedAt',stamp
  ), revision=revision+1,updated_at=stamp WHERE module='approvals' AND id=p_id;
  INSERT INTO crm_backend.write_audit(request_id,actor,module,record_id,operation,payload_hash,revision,recorded_at)
  VALUES(p_request,auth.uid(),'approvals',p_id,'save',digest,p_revision+1,stamp);
  RETURN jsonb_build_object('id',p_id,'revision',p_revision+1,'updated_at',stamp,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.crm_decide_approval(uuid,text,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_decide_approval(uuid,text,bigint,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.validate_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.module<>'approvals' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.payload->>'status' IN ('ONAYLANDI','REDDEDILDI') THEN
    RAISE EXCEPTION 'crm_approval_workflow_required' USING ERRCODE='42501';
  END IF;
  IF NEW.deleted THEN RETURN NEW; END IF;
  IF length(btrim(coalesce(NEW.payload->>'title',''))) NOT BETWEEN 1 AND 500
     OR length(btrim(coalesce(NEW.payload->>'reason',''))) NOT BETWEEN 1 AND 4000
     OR coalesce(NEW.payload->>'type','') NOT IN ('İskonto / İndirim','Kapora İadesi','Rezervasyon Uzatma','Özel Ödeme Planı')
     OR coalesce(NEW.payload->>'status','') NOT IN ('BEKLEMEDE','ONAYLANDI','REDDEDILDI')
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  NEW.payload:=NEW.payload || jsonb_build_object('requestedByUserId',NEW.owner_id,'requestedDepartment',NEW.department,'createdAt',NEW.created_at);
  IF NEW.payload->>'status'='BEKLEMEDE' THEN
    NEW.payload:=NEW.payload-'reviewedByUserId'-'reviewedByUserName'-'reviewedAt'-'reviewNotes';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_approval() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_approval ON crm_backend.records;
CREATE TRIGGER crm_validate_approval BEFORE INSERT OR UPDATE ON crm_backend.records
FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_approval();
COMMIT;

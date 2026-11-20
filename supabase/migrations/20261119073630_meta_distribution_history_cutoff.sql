BEGIN;
ALTER TABLE crm_backend.meta_distribution_state ADD COLUMN IF NOT EXISTS assignment_start_at timestamptz NOT NULL DEFAULT '2026-11-18T00:00:00+03:00';
INSERT INTO crm_backend.meta_distribution_state(company_name) SELECT company_name FROM crm_backend.lead_workspace WHERE singleton ON CONFLICT DO NOTHING;
COMMENT ON COLUMN crm_backend.meta_distribution_state.assignment_start_at IS 'Older imported submissions stay unassigned; existing assignments are retained.';
CREATE OR REPLACE FUNCTION crm_backend.assign_incoming_meta_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE company text; target public.app_users%ROWTYPE; next_turn bigint; actor text; eligible_since timestamptz; submitted timestamptz;
BEGIN
 IF nullif(NEW.assigned_to_user_id,'') IS NOT NULL OR NOT (
  NEW.source IN ('META_ADS','FACEBOOK','INSTAGRAM') OR NEW.meta_lead_id IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.meta_lead_events e WHERE e.lead_id=NEW.id)
 ) OR EXISTS(SELECT 1 FROM crm_backend.lead_archives WHERE lead_id=NEW.id) THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  SELECT u.role INTO actor FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id WHERE i.auth_user_id=auth.uid() AND i.active;
  IF actor IS DISTINCT FROM 'ADMIN' THEN RETURN NEW; END IF;
 END IF;
 SELECT company_name INTO company FROM crm_backend.lead_workspace WHERE singleton;
 IF company IS NULL THEN RAISE EXCEPTION 'crm_meta_workspace_missing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('meta-round-robin:'||company,0));
 INSERT INTO crm_backend.meta_distribution_state(company_name) VALUES(company) ON CONFLICT DO NOTHING;
 SELECT assignment_start_at INTO eligible_since FROM crm_backend.meta_distribution_state WHERE company_name=company;
 SELECT greatest(NEW.created_at,max(e.submitted_at)) INTO submitted FROM public.meta_lead_events e WHERE e.lead_id=NEW.id;
 IF submitted IS NULL OR submitted<eligible_since THEN RETURN NEW; END IF;
 SELECT u.* INTO target FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
 LEFT JOIN crm_backend.meta_distribution_turns t ON t.company_name=u.company_name AND t.app_user_id=u.id
 WHERE u.company_name=company AND u.department='Müşteri İlişkileri' AND u.role<>'ADMIN'
 ORDER BY coalesce(t.last_turn,0),u.created_at,u.id LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 UPDATE crm_backend.meta_distribution_state SET turn=turn+1,last_assigned_user_id=target.id,updated_at=clock_timestamp()
 WHERE company_name=company RETURNING turn INTO next_turn;
 INSERT INTO crm_backend.meta_distribution_turns(company_name,app_user_id,last_turn) VALUES(company,target.id,next_turn)
 ON CONFLICT(company_name,app_user_id) DO UPDATE SET last_turn=excluded.last_turn;
 NEW.assigned_to_user_id:=target.id;NEW.assigned_to_user_name:=target.full_name;NEW.owner:=target.full_name;
 NEW.assignment_history:=coalesce(NEW.assignment_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
  'id','meta-assignment-'||next_turn,'assignedToUserId',target.id,'assignedToUserName',target.full_name,
  'assignedByUserId','system','assignedByUserName','Otomatik Dağıtım','assignedAt',clock_timestamp(),
  'note','Sunucuda sırayla otomatik atandı.'));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.assign_incoming_meta_lead() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_meta_distribution_policy() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
 SELECT jsonb_build_object('assignment_from',s.assignment_start_at,'version',20261119073630::bigint) INTO result
 FROM crm_backend.meta_distribution_state s JOIN crm_backend.lead_workspace w ON w.company_name=s.company_name
 WHERE s.company_name=p->>'company_name';
 IF result IS NULL THEN RAISE EXCEPTION 'crm_lead_forbidden' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_meta_distribution_policy() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_meta_distribution_policy() TO authenticated;
COMMIT;
SELECT to_char(assignment_start_at AT TIME ZONE 'Europe/Istanbul','DD.MM.YYYY HH24:MI') AS temsilci_atama_baslangici, '17 Kasim ve oncesi temsilciye otomatik atanmaz' AS sonuc
FROM crm_backend.meta_distribution_state s JOIN crm_backend.lead_workspace w USING(company_name) WHERE w.singleton;

-- Bind this permission once to the two existing company identities.
CREATE TABLE crm_backend.account_switch_admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE crm_backend.account_switch_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.account_switch_admins FROM PUBLIC, anon, authenticated;
INSERT INTO crm_backend.account_switch_admins
SELECT i.auth_user_id FROM public.crm_identities i JOIN public.app_users u ON u.id = i.app_user_id
WHERE i.active AND u.company_name = 'Demirtürk İnşaat' AND u.role = 'ADMIN'
  AND lower(u.username) IN ('berkant','murat');

CREATE TABLE crm_backend.account_switch_audit (
  request_id uuid PRIMARY KEY,
  actor uuid NOT NULL, actor_session uuid NOT NULL, target uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), granted_at timestamptz,
  target_session uuid UNIQUE
);
CREATE INDEX account_switch_by_actor ON crm_backend.account_switch_audit (actor, created_at);
ALTER TABLE crm_backend.account_switch_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.account_switch_audit FROM PUBLIC, anon, authenticated;

CREATE FUNCTION crm_backend.switch_company(actor uuid, actor_session uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.company_name FROM crm_backend.account_switch_admins p
  JOIN public.crm_identities i ON i.auth_user_id = p.auth_user_id AND i.active
  JOIN public.app_users u ON u.id = i.app_user_id
  JOIN auth.users a ON a.id = i.auth_user_id
  JOIN auth.sessions s ON s.user_id = a.id AND s.id = actor_session
  WHERE p.auth_user_id = actor AND u.role = 'ADMIN' AND NOT u.must_change_password
    AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until <= now())
    AND (s.not_after IS NULL OR s.not_after > now())
    AND (s.aal = 'aal2' OR NOT EXISTS (
      SELECT FROM auth.mfa_factors f WHERE f.user_id = a.id AND f.status = 'verified'))
$$;

CREATE FUNCTION crm_backend.switch_targets(company text)
RETURNS TABLE(id text, username text, full_name text, department text, auth_id uuid, email text, available boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u.username, u.full_name, u.department, a.id, a.email::text,
    (NOT u.must_change_password AND a.email_confirmed_at IS NOT NULL AND a.email IS NOT NULL
     AND NOT EXISTS (SELECT FROM auth.mfa_factors f WHERE f.user_id = a.id AND f.status = 'verified'))
  FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id = u.id AND i.active
  JOIN auth.users a ON a.id = i.auth_user_id
  WHERE u.company_name = company AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until <= now())
    AND (u.role <> 'ADMIN' OR EXISTS (SELECT FROM crm_backend.account_switch_admins p WHERE p.auth_user_id = a.id))
$$;

CREATE FUNCTION public.crm_account_switch_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE company text := crm_backend.switch_company(auth.uid(), (auth.jwt()->>'session_id')::uuid);
BEGIN
  IF company IS NULL THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'fullName', t.full_name,
    'department', t.department, 'username', t.username, 'available', t.available) ORDER BY t.full_name), '[]'::jsonb)
    FROM crm_backend.switch_targets(company) t WHERE t.auth_id <> auth.uid());
END $$;

-- Service-only RPCs. The Edge function derives actor and actor_session from a verified bearer.
CREATE FUNCTION public.crm_begin_account_switch(p_actor uuid, p_session uuid, p_id text, p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE company text := crm_backend.switch_company(p_actor, p_session); target record;
BEGIN
  IF company IS NULL THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO target FROM crm_backend.switch_targets(company) t WHERE t.id = p_id AND t.available AND t.auth_id <> p_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'crm_target_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('crm-switch:' || p_actor::text, 0));
  IF (SELECT count(*) FROM crm_backend.account_switch_audit WHERE actor = p_actor AND created_at > now()-interval '1 hour') >= 100
    THEN RAISE EXCEPTION 'crm_rate_limited'; END IF;
  INSERT INTO crm_backend.account_switch_audit(request_id,actor,actor_session,target) VALUES(p_request,p_actor,p_session,target.auth_id);
  RETURN jsonb_build_object('authId',target.auth_id,'email',target.email);
END $$;

CREATE FUNCTION public.crm_finish_account_switch(p_request uuid, p_target uuid, p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE grant_row crm_backend.account_switch_audit%ROWTYPE; company text;
BEGIN
  SELECT * INTO grant_row FROM crm_backend.account_switch_audit WHERE request_id=p_request AND target=p_target
    AND granted_at IS NULL AND created_at > now()-interval '2 minutes' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  company := crm_backend.switch_company(grant_row.actor, grant_row.actor_session);
  IF NOT EXISTS (SELECT FROM crm_backend.switch_targets(company) t WHERE t.auth_id=p_target AND t.available)
    THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
  -- Bound only the new GoTrue session, never the employee's normal sign-ins.
  UPDATE auth.sessions SET not_after = least(not_after, now()+interval '8 hours')
  WHERE id=p_session AND user_id=p_target AND created_at >= grant_row.created_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'crm_new_session_required'; END IF;
  UPDATE crm_backend.account_switch_audit SET granted_at=now(), target_session=p_session WHERE request_id=p_request;
END $$;

REVOKE ALL ON FUNCTION crm_backend.switch_company(uuid,uuid), crm_backend.switch_targets(text),
  public.crm_account_switch_directory(), public.crm_begin_account_switch(uuid,uuid,text,uuid),
  public.crm_finish_account_switch(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_account_switch_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_begin_account_switch(uuid,uuid,text,uuid), public.crm_finish_account_switch(uuid,uuid,uuid) TO service_role;

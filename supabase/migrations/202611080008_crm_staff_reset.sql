BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.staff_resets (
 request_id uuid PRIMARY KEY, actor uuid NOT NULL REFERENCES auth.users(id),
 auth_user_id uuid NOT NULL REFERENCES auth.users(id), lease_id uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed boolean NOT NULL DEFAULT false
);
ALTER TABLE crm_backend.staff_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.staff_resets FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_staff_reset_target(p_id text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); target uuid; username text; lease uuid;
BEGIN
 IF p->>'role'<>'ADMIN' OR p_request IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_staff_reset_actor:'||auth.uid()::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_staff_reset_target:'||coalesce(p_id,''),0));
 SELECT s.auth_user_id,s.username INTO target,username FROM crm_backend.staff_accounts s
 JOIN public.app_users u ON u.id='auth-'||s.auth_user_id::text
 WHERE u.id=p_id AND u.company_name=coalesce(p->>'company_name','') AND u.role<>'ADMIN';
 IF target IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM crm_backend.staff_resets WHERE request_id=p_request)
 OR EXISTS(SELECT 1 FROM crm_backend.staff_resets WHERE auth_user_id=target AND NOT completed AND created_at>clock_timestamp()-interval '5 minutes')
 THEN RAISE EXCEPTION 'crm_reset_in_progress'; END IF;
 IF (SELECT count(*) FROM crm_backend.staff_resets WHERE actor=auth.uid() AND created_at>clock_timestamp()-interval '1 hour')>=20
 THEN RAISE EXCEPTION 'crm_rate_limited'; END IF;
 INSERT INTO crm_backend.staff_resets(request_id,actor,auth_user_id) VALUES(p_request,auth.uid(),target) RETURNING lease_id INTO lease;
 -- Eski JWT, parola resetinin ara aşamasında iş kayıtlarına erişemez.
 UPDATE crm_backend.staff_accounts SET initial_password_digest=(SELECT encode(sha256(convert_to(encrypted_password,'UTF8')),'hex') FROM auth.users WHERE id=target) WHERE auth_user_id=target;
 UPDATE public.app_users SET must_change_password=true WHERE id=p_id;
 RETURN jsonb_build_object('auth_user_id',target,'username',username,'lease_id',lease);
END $$;
REVOKE ALL ON FUNCTION public.crm_staff_reset_target(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_staff_reset_target(text,uuid) TO authenticated;
-- Eski, kilitsiz başlangıç yolu artık çağrılamaz.
REVOKE ALL ON FUNCTION public.crm_staff_reset_target(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_finish_staff_reset(p_actor uuid,p_auth_user uuid,p_request uuid,p_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE operation crm_backend.staff_resets%ROWTYPE;
BEGIN
 SELECT * INTO operation FROM crm_backend.staff_resets WHERE request_id=p_request FOR UPDATE;
 IF NOT FOUND OR operation.actor<>p_actor OR operation.auth_user_id<>p_auth_user OR operation.lease_id<>p_lease
 OR operation.completed OR operation.created_at<clock_timestamp()-interval '5 minutes'
 THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 PERFORM public.crm_mark_staff_password_reset(p_actor,p_auth_user);
 UPDATE crm_backend.staff_resets SET completed=true WHERE request_id=p_request;
END $$;
REVOKE ALL ON FUNCTION public.crm_finish_staff_reset(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_finish_staff_reset(uuid,uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.crm_finish_initial_password() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s crm_backend.staff_accounts%ROWTYPE; password_hash text;
BEGIN
  IF EXISTS(SELECT 1 FROM crm_backend.staff_resets WHERE auth_user_id=auth.uid() AND NOT completed AND created_at>clock_timestamp()-interval '5 minutes') THEN RAISE EXCEPTION 'crm_reset_in_progress'; END IF;
  SELECT * INTO s FROM crm_backend.staff_accounts WHERE auth_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT encrypted_password INTO password_hash FROM auth.users WHERE id=auth.uid();
  IF s.initial_password_digest=encode(sha256(convert_to(password_hash,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'crm_password_change_required'; END IF;
  UPDATE public.app_users SET must_change_password=false WHERE id='auth-'||auth.uid()::text;
  UPDATE crm_backend.staff_accounts SET initial_password_digest=NULL WHERE request_id=s.request_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_finish_initial_password() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_finish_initial_password() TO authenticated;

CREATE INDEX IF NOT EXISTS crm_staff_resets_actor_time ON crm_backend.staff_resets(actor,created_at);
CREATE INDEX IF NOT EXISTS crm_staff_resets_target_time ON crm_backend.staff_resets(auth_user_id,created_at);
COMMIT;

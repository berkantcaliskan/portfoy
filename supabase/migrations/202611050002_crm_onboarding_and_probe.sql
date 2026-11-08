-- Kapalı personel daveti ve müşteri verisinden ayrı kalıcılık doğrulaması.
-- Meta üyeliği/rolü veya mevcut personel parolası değiştirilmez.
BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.staff_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 email text NOT NULL,
 full_name text NOT NULL,
 department text NOT NULL CHECK(department IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')),
 role text NOT NULL CHECK(role IN ('MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER')),
 scope text NOT NULL CHECK(scope IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')),
 company_name text NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '48 hours',
 accepted_by uuid REFERENCES auth.users(id),
 accepted_at timestamptz,
 revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_pending_invite_email ON crm_backend.staff_invites(email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS crm_backend.persistence_probes (
 auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 note text NOT NULL CHECK(length(note)<=200),
 revision bigint NOT NULL,
 request_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_backend.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.persistence_probes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.staff_invites,crm_backend.persistence_probes FROM PUBLIC,anon,authenticated;
GRANT ALL ON crm_backend.staff_invites,crm_backend.persistence_probes TO service_role;

CREATE OR REPLACE FUNCTION public.crm_create_staff_invite(p_email text,p_name text,p_department text,p_role text DEFAULT 'MEMBER',p_scope text DEFAULT 'ASSIGNED_ONLY')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb; token text; invite crm_backend.staff_invites%ROWTYPE; canonical_email text;
BEGIN
 p:=public.crm_get_my_profile();
 IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_admin_required' USING ERRCODE='42501'; END IF;
 canonical_email:=lower(btrim(p_email));
 IF canonical_email IS NULL OR length(canonical_email)>254 OR canonical_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 150
 OR p_department IS NULL OR p_department NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
 OR p_role IS NULL OR p_role NOT IN ('MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER')
 OR p_scope IS NULL OR p_scope NOT IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')
 THEN RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_invite:'||canonical_email,0));
 IF EXISTS(SELECT 1 FROM public.crm_identities i JOIN auth.users u ON u.id=i.auth_user_id WHERE lower(u.email)=canonical_email)
 THEN RAISE EXCEPTION 'crm_identity_already_assigned' USING ERRCODE='23505'; END IF;
 UPDATE crm_backend.staff_invites SET revoked_at=now() WHERE email=canonical_email AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM crm_backend.staff_invites WHERE email=canonical_email AND accepted_at IS NULL AND revoked_at IS NULL)
 THEN RAISE EXCEPTION 'crm_invite_already_pending' USING ERRCODE='23505'; END IF;
 IF (SELECT count(*) FROM crm_backend.staff_invites WHERE created_by=auth.uid() AND created_at>now()-interval '1 hour')>=20
 THEN RAISE EXCEPTION 'crm_rate_limited' USING ERRCODE='54000'; END IF;
 token:=gen_random_uuid()::text||gen_random_uuid()::text;
 INSERT INTO crm_backend.staff_invites(token_hash,email,full_name,department,role,scope,company_name,created_by)
 VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),canonical_email,btrim(p_name),p_department,p_role,p_scope,coalesce(p->>'company_name',''),auth.uid()) RETURNING * INTO invite;
 -- Ham davet yalnızca oluşturma cevabında; listeye veya audit loguna konmaz.
 RETURN jsonb_build_object('id',invite.id,'token',token,'expires_at',invite.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.crm_create_staff_invite(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_staff_invite(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_check_staff_invite(p_token text,p_email text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE expiry timestamptz;
BEGIN
 IF p_token IS NULL OR length(p_token) NOT BETWEEN 60 AND 100 OR p_email IS NULL THEN RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501'; END IF;
 SELECT s.expires_at INTO expiry FROM crm_backend.staff_invites s
 JOIN public.crm_identities i ON i.auth_user_id=s.created_by AND i.active
 JOIN public.app_users u ON u.id=i.app_user_id AND u.role='ADMIN' AND coalesce(u.company_name,'')=s.company_name
 WHERE s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND s.email=lower(btrim(p_email)) AND s.revoked_at IS NULL AND s.accepted_at IS NULL AND s.expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('valid',true,'expires_at',expiry);
END $$;
REVOKE ALL ON FUNCTION public.crm_check_staff_invite(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_check_staff_invite(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_accept_staff_invite(p_token text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); invite crm_backend.staff_invites%ROWTYPE; verified_email text; confirmed timestamptz; staff_id text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
 IF p_token IS NOT NULL AND length(p_token) NOT BETWEEN 60 AND 100 THEN RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501'; END IF;
 SELECT lower(email),email_confirmed_at INTO verified_email,confirmed FROM auth.users WHERE id=actor;
 IF confirmed IS NULL OR verified_email IS NULL THEN RAISE EXCEPTION 'crm_email_confirmation_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_accept:'||actor::text,0));
 SELECT * INTO invite FROM crm_backend.staff_invites
 WHERE (p_token IS NOT NULL AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'))
 OR (p_token IS NULL AND email=verified_email AND (accepted_by=actor OR accepted_at IS NULL))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR invite.email<>verified_email OR invite.revoked_at IS NOT NULL OR (invite.accepted_at IS NULL AND invite.expires_at<=now())
 THEN RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501'; END IF;
 IF invite.accepted_at IS NOT NULL THEN
  IF invite.accepted_by=actor THEN RETURN public.crm_get_my_profile(); END IF;
  RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.crm_identities WHERE auth_user_id=actor) THEN RAISE EXCEPTION 'crm_identity_already_assigned' USING ERRCODE='23505'; END IF;
 -- Davet eden yöneticinin yetkisi arada kaldırıldıysa eski davet kabul edilmez.
 IF NOT EXISTS(SELECT 1 FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id WHERE i.auth_user_id=invite.created_by AND i.active AND u.role='ADMIN' AND coalesce(u.company_name,'')=invite.company_name)
 THEN RAISE EXCEPTION 'crm_invite_invalid' USING ERRCODE='42501'; END IF;
 staff_id:='auth-'||actor::text;
 INSERT INTO public.app_users(id,full_name,username,password,email,company_name,department,departments,role,scope,is_manager,permissions)
 VALUES(staff_id,invite.full_name,staff_id,'disabled:'||gen_random_uuid()::text||gen_random_uuid()::text,verified_email,invite.company_name,
 invite.department,jsonb_build_array(invite.department),invite.role,invite.scope,invite.role='MANAGER','{}'::jsonb);
 -- Legacy NOT NULL password sütununda gerçek parola yoktur; Auth parolası yalnızca GoTrue'dadır.
 INSERT INTO public.crm_identities(auth_user_id,app_user_id) VALUES(actor,staff_id);
 UPDATE crm_backend.staff_invites SET accepted_by=actor,accepted_at=now() WHERE id=invite.id;
 RETURN public.crm_get_my_profile();
END $$;
REVOKE ALL ON FUNCTION public.crm_accept_staff_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_accept_staff_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_revoke_staff_invite(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb;
BEGIN
 p:=public.crm_get_my_profile();
 IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_admin_required' USING ERRCODE='42501'; END IF;
 UPDATE crm_backend.staff_invites SET revoked_at=coalesce(revoked_at,now()) WHERE id=p_id AND company_name=coalesce(p->>'company_name','') AND accepted_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.crm_revoke_staff_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_revoke_staff_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_get_persistence_probe() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb; result jsonb;
BEGIN
 p:=public.crm_get_my_profile();
 SELECT jsonb_build_object('note',note,'revision',revision,'updated_at',updated_at) INTO result FROM crm_backend.persistence_probes WHERE auth_user_id=auth.uid();
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.crm_save_persistence_probe(p_request uuid,p_revision bigint,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb; previous crm_backend.persistence_probes%ROWTYPE;
BEGIN
 p:=public.crm_get_my_profile();
 IF p_request IS NULL OR p_revision IS NULL OR p_revision<0 OR p_note IS NULL OR length(p_note)>200 THEN RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_probe:'||auth.uid()::text,0));
 SELECT * INTO previous FROM crm_backend.persistence_probes WHERE auth_user_id=auth.uid() FOR UPDATE;
 IF previous.request_id=p_request THEN
  IF previous.note<>p_note THEN RAISE EXCEPTION 'crm_request_conflict' USING ERRCODE='40001'; END IF;
  RETURN public.crm_get_persistence_probe();
 END IF;
 IF coalesce(previous.revision,0)<>p_revision THEN RAISE EXCEPTION 'crm_revision_conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO crm_backend.persistence_probes(auth_user_id,note,revision,request_id) VALUES(auth.uid(),p_note,p_revision+1,p_request)
 ON CONFLICT(auth_user_id) DO UPDATE SET note=excluded.note,revision=excluded.revision,request_id=excluded.request_id,updated_at=clock_timestamp();
 RETURN public.crm_get_persistence_probe();
END $$;
REVOKE ALL ON FUNCTION public.crm_get_persistence_probe(),public.crm_save_persistence_probe(uuid,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_get_persistence_probe(),public.crm_save_persistence_probe(uuid,bigint,text) TO authenticated;
COMMIT;

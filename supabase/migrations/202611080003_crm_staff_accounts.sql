BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.staff_accounts (
  request_id uuid PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  department text NOT NULL,
  role text NOT NULL,
  scope text NOT NULL,
  company_name text NOT NULL,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id),
  initial_password_digest text,
  lease_id uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_until timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_backend.staff_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.staff_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON crm_backend.staff_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.crm_prepare_staff(p_request uuid,p_username text,p_name text,p_department text,p_role text,p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result crm_backend.staff_accounts%ROWTYPE;
BEGIN
  IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF p_request IS NULL OR p_username IS NULL OR p_username !~ '^[a-z][a-z0-9._-]{2,39}$'
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 150
     OR p_department IS NULL OR p_department NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
     OR p_role IS NULL OR p_role NOT IN ('MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER')
     OR p_scope IS NULL OR p_scope NOT IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_staff:'||auth.uid()::text,0));
  SELECT * INTO result FROM crm_backend.staff_accounts WHERE request_id=p_request;
  IF FOUND THEN
    IF result.created_by<>auth.uid() OR result.username<>p_username OR result.full_name<>btrim(p_name)
       OR result.department<>p_department OR result.role<>p_role OR result.scope<>p_scope
    THEN RAISE EXCEPTION 'crm_request_conflict'; END IF;
    IF result.auth_user_id IS NULL THEN
      IF result.lease_until>now() THEN RAISE EXCEPTION 'crm_operation_processing'; END IF;
      UPDATE crm_backend.staff_accounts SET lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes'
      WHERE request_id=p_request RETURNING * INTO result;
    END IF;
    RETURN to_jsonb(result)-'initial_password_digest';
  END IF;
  IF EXISTS(SELECT 1 FROM public.app_users WHERE lower(username)=p_username)
  THEN RAISE EXCEPTION 'crm_username_taken'; END IF;
  IF (SELECT count(*) FROM crm_backend.staff_accounts WHERE created_by=auth.uid() AND created_at>now()-interval '1 hour')>=20
  THEN RAISE EXCEPTION 'crm_rate_limited'; END IF;
  INSERT INTO crm_backend.staff_accounts(request_id,created_by,username,full_name,department,role,scope,company_name)
  VALUES(p_request,auth.uid(),p_username,btrim(p_name),p_department,p_role,p_scope,coalesce(p->>'company_name','')) RETURNING * INTO result;
  RETURN to_jsonb(result)-'initial_password_digest';
END $$;
REVOKE ALL ON FUNCTION public.crm_prepare_staff(uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_prepare_staff(uuid,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_finalize_staff(p_actor uuid,p_request uuid,p_auth_user uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s crm_backend.staff_accounts%ROWTYPE; actor_company text; target_email text; password_hash text; staff_id text;
BEGIN
  SELECT u.company_name INTO actor_company FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
  WHERE i.auth_user_id=p_actor AND i.active AND u.role='ADMIN';
  IF NOT FOUND THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  SELECT * INTO s FROM crm_backend.staff_accounts WHERE request_id=p_request AND created_by=p_actor FOR UPDATE;
  IF NOT FOUND OR s.company_name<>actor_company OR s.lease_id IS DISTINCT FROM p_lease OR s.lease_until<now()
  THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  SELECT email,encrypted_password INTO target_email,password_hash FROM auth.users WHERE id=p_auth_user;
  IF target_email IS DISTINCT FROM s.username||'@staff.demirturk.invalid' OR coalesce(password_hash,'')=''
  THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF s.auth_user_id IS NOT NULL THEN
    IF s.auth_user_id<>p_auth_user THEN RAISE EXCEPTION 'crm_request_conflict'; END IF;
    RETURN jsonb_build_object('id','auth-'||p_auth_user::text,'username',s.username);
  END IF;
  staff_id:='auth-'||p_auth_user::text;
  INSERT INTO public.app_users(id,full_name,username,password,email,company_name,department,departments,role,is_manager,scope,permissions,must_change_password)
  VALUES(staff_id,s.full_name,s.username,'disabled-'||gen_random_uuid()::text,NULL,s.company_name,s.department,jsonb_build_array(s.department),s.role,s.role='MANAGER',s.scope,'{}',true);
  INSERT INTO public.crm_identities(auth_user_id,app_user_id) VALUES(p_auth_user,staff_id);
  UPDATE crm_backend.staff_accounts SET auth_user_id=p_auth_user,initial_password_digest=encode(sha256(convert_to(password_hash,'UTF8')),'hex') WHERE request_id=p_request;
  RETURN jsonb_build_object('id',staff_id,'username',s.username);
END $$;
REVOKE ALL ON FUNCTION public.crm_finalize_staff(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_finalize_staff(uuid,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_finish_initial_password() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s crm_backend.staff_accounts%ROWTYPE; password_hash text;
BEGIN
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

CREATE OR REPLACE FUNCTION public.crm_staff_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'fullName',u.full_name,'username',u.username,
    'companyName',u.company_name,'department',u.department,'departments',u.departments,
    'role',u.role,'scope',u.scope,'isManager',u.is_manager,'permissions',u.permissions,'createdAt',u.created_at) ORDER BY u.full_name),'[]')
  INTO result FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
  WHERE i.active AND coalesce(u.company_name,'')=coalesce(p->>'company_name','');
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_staff_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_staff_directory() TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_get_my_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
 SELECT jsonb_build_object(
  'auth_user_id',i.auth_user_id,'id',u.id,'full_name',u.full_name,'username',u.username,
  'email',u.email,'avatar_url',u.avatar_url,'company_name',u.company_name,
  'department',u.department,'departments',u.departments,'role',u.role,'scope',u.scope,
  'is_manager',u.is_manager,'must_change_password',u.must_change_password,'permissions',u.permissions,'created_at',u.created_at)
 INTO result FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
 WHERE i.auth_user_id=auth.uid() AND i.active;
 IF result IS NULL THEN RAISE EXCEPTION 'crm_identity_not_assigned' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_get_my_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_get_my_profile() TO authenticated,service_role;


CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
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


CREATE OR REPLACE FUNCTION public.crm_pending_staff_auth(p_actor uuid,p_request uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id FROM crm_backend.staff_accounts s
 JOIN auth.users a ON a.email=s.username||'@staff.demirturk.invalid'
 JOIN public.crm_identities i ON i.auth_user_id=p_actor AND i.active
 JOIN public.app_users u ON u.id=i.app_user_id AND u.role='ADMIN' AND u.company_name=s.company_name
 WHERE s.request_id=p_request AND s.created_by=p_actor AND s.auth_user_id IS NULL
 AND a.raw_app_meta_data->>'crm_staff_request'=p_request::text
 AND NOT EXISTS(SELECT 1 FROM public.crm_identities existing WHERE existing.auth_user_id=a.id)
$$;
REVOKE ALL ON FUNCTION public.crm_pending_staff_auth(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_pending_staff_auth(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_staff_reset_target(p_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
 IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 SELECT jsonb_build_object('auth_user_id',s.auth_user_id,'username',s.username) INTO result
 FROM crm_backend.staff_accounts s JOIN public.app_users u ON u.id='auth-'||s.auth_user_id::text
 WHERE u.id=p_id AND u.company_name=coalesce(p->>'company_name','') AND u.role<>'ADMIN';
 IF result IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_staff_reset_target(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_staff_reset_target(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_mark_staff_password_reset(p_actor uuid,p_auth_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target text; password_hash text;
BEGIN
 SELECT u.id INTO target FROM crm_backend.staff_accounts s
 JOIN public.app_users u ON u.id='auth-'||s.auth_user_id::text
 JOIN public.crm_identities actor ON actor.auth_user_id=p_actor AND actor.active
 JOIN public.app_users admin ON admin.id=actor.app_user_id AND admin.role='ADMIN' AND admin.company_name=u.company_name
 WHERE s.auth_user_id=p_auth_user AND u.role<>'ADMIN';
 IF target IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 SELECT encrypted_password INTO password_hash FROM auth.users WHERE id=p_auth_user;
 UPDATE public.app_users SET must_change_password=true WHERE id=target;
 UPDATE crm_backend.staff_accounts SET initial_password_digest=encode(sha256(convert_to(password_hash,'UTF8')),'hex') WHERE auth_user_id=p_auth_user;
END $$;
REVOKE ALL ON FUNCTION public.crm_mark_staff_password_reset(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_mark_staff_password_reset(uuid,uuid) TO service_role;
COMMIT;

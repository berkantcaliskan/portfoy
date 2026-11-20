BEGIN;
-- Dedicated Front Office staff use no other department. Existing identities and data stay unchanged.
CREATE OR REPLACE FUNCTION public.crm_prepare_staff(p_request uuid,p_username text,p_name text,p_department text,p_role text,p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result crm_backend.staff_accounts%ROWTYPE;
BEGIN
  IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
  IF p_request IS NULL OR p_username IS NULL OR p_username !~ '^[a-z][a-z0-9._-]{2,39}$'
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 150
     OR p_department IS NULL OR p_department NOT IN ('Ön Ofis','Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
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
  IF s.department='Ön Ofis' THEN
    INSERT INTO crm_backend.office_access(app_user_id,granted_by) VALUES(staff_id,p_actor);
    INSERT INTO crm_backend.staff_admin_audit(actor,target_id,operation) VALUES(p_actor,staff_id,'office_grant');
  END IF;
  UPDATE crm_backend.staff_accounts SET auth_user_id=p_auth_user,initial_password_digest=encode(sha256(convert_to(password_hash,'UTF8')),'hex') WHERE request_id=p_request;
  RETURN jsonb_build_object('id',staff_id,'username',s.username);
END $$;
REVOKE ALL ON FUNCTION public.crm_finalize_staff(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_finalize_staff(uuid,uuid,uuid,uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.crm_manage_staff(p_id text,p_updates jsonb DEFAULT '{}',p_disable boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); target public.app_users%ROWTYPE; dept text; role_name text; access_scope text; depts jsonb; staff_permissions jsonb;
BEGIN
 IF p->>'role'<>'ADMIN' OR coalesce((p->>'must_change_password')::boolean,false) THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF p_updates IS NULL OR jsonb_typeof(p_updates)<>'object' OR octet_length(p_updates::text)>8192 OR p_disable IS NULL
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 SELECT u.* INTO target FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active JOIN crm_backend.staff_accounts s ON s.auth_user_id=i.auth_user_id
 WHERE u.id=p_id AND u.company_name=coalesce(p->>'company_name','') AND u.role<>'ADMIN' FOR UPDATE OF u;
 IF NOT FOUND OR target.id=p->>'id' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM crm_backend.staff_accounts s JOIN public.crm_identities i ON i.auth_user_id=s.auth_user_id WHERE i.app_user_id=p_id AND s.revision::text=p_updates->>'_revision')
 THEN RAISE EXCEPTION 'crm_revision_conflict'; END IF;
 dept:=coalesce(p_updates->>'department',target.department);
 role_name:=coalesce(p_updates->>'role',target.role);
 access_scope:=coalesce(p_updates->>'scope',target.scope);
 depts:=coalesce(p_updates->'departments',target.departments);
 staff_permissions:=coalesce(p_updates->'permissions',target.permissions);
 IF dept NOT IN ('Ön Ofis','Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
 OR role_name NOT IN ('ADMIN','MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER') OR access_scope NOT IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')
 OR jsonb_typeof(depts)<>'array' OR jsonb_typeof(staff_permissions)<>'object'
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(depts) v WHERE v NOT IN ('Ön Ofis','Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim'))
 OR EXISTS(SELECT 1 FROM jsonb_each(staff_permissions) v WHERE jsonb_typeof(v.value)<>'boolean' OR v.key NOT IN (
 'canPullLeads','canAddCustomer','canDeleteCustomer','canAssignConsultant','canChangeStage','canManageMetaConfig',
 'canEditProjectPrice','canChangeFlatStatus','canApproveDiscounts','canRefundDeposit','canManageTeam','canReshareFiles'))
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF role_name='ADMIN' THEN access_scope:='ALL'; depts:='["Satış","Kreatif","Müşteri İlişkileri","Muhasebe","Pazarlama","Yönetim"]'::jsonb; END IF;
 IF NOT depts ? dept THEN depts:=depts||jsonb_build_array(dept); END IF;
 UPDATE public.app_users SET department=dept,departments=depts,role=role_name,is_manager=role_name IN ('ADMIN','MANAGER'),scope=access_scope,permissions=staff_permissions WHERE id=p_id;
 UPDATE crm_backend.staff_accounts SET revision=revision+1 WHERE auth_user_id=(SELECT auth_user_id FROM public.crm_identities WHERE app_user_id=p_id);
 IF p_disable THEN UPDATE public.crm_identities SET active=false WHERE app_user_id=p_id; END IF;
 INSERT INTO crm_backend.staff_admin_audit(actor,target_id,operation) VALUES(auth.uid(),p_id,CASE WHEN p_disable THEN 'disable' ELSE 'update' END);
END $$;
REVOKE ALL ON FUNCTION public.crm_manage_staff(text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_manage_staff(text,jsonb,boolean) TO authenticated;



COMMIT;

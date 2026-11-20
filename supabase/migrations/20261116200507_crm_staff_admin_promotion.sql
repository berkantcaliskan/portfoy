BEGIN;

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
 IF dept NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
 OR role_name NOT IN ('ADMIN','MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER') OR access_scope NOT IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')
 OR jsonb_typeof(depts)<>'array' OR jsonb_typeof(staff_permissions)<>'object'
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(depts) v WHERE v NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim'))
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

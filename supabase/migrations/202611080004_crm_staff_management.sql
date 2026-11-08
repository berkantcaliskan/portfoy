BEGIN;
ALTER TABLE crm_backend.staff_accounts ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS crm_backend.staff_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor uuid NOT NULL, target_id text NOT NULL,
 operation text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_backend.staff_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.staff_admin_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_manage_staff(p_id text,p_updates jsonb DEFAULT '{}',p_disable boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); target public.app_users%ROWTYPE; dept text; role_name text; access_scope text; depts jsonb; staff_permissions jsonb;
BEGIN
 IF p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 IF p_updates IS NULL OR jsonb_typeof(p_updates)<>'object' OR octet_length(p_updates::text)>8192 OR p_disable IS NULL
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF NOT EXISTS(SELECT 1 FROM crm_backend.staff_accounts WHERE 'auth-'||auth_user_id::text=p_id AND revision::text=p_updates->>'_revision')
 THEN RAISE EXCEPTION 'crm_revision_conflict'; END IF;
 SELECT u.* INTO target FROM public.app_users u JOIN crm_backend.staff_accounts s ON u.id='auth-'||s.auth_user_id::text
 WHERE u.id=p_id AND u.company_name=coalesce(p->>'company_name','') AND u.role<>'ADMIN' FOR UPDATE OF u;
 IF NOT FOUND OR target.id=p->>'id' THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 dept:=coalesce(p_updates->>'department',target.department);
 role_name:=coalesce(p_updates->>'role',target.role);
 access_scope:=coalesce(p_updates->>'scope',target.scope);
 depts:=coalesce(p_updates->'departments',target.departments);
 staff_permissions:=coalesce(p_updates->'permissions',target.permissions);
 IF dept NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim')
 OR role_name NOT IN ('MANAGER','SPECIALIST','REPRESENTATIVE','MEMBER') OR access_scope NOT IN ('ALL','DEPARTMENT','ASSIGNED_ONLY')
 OR jsonb_typeof(depts)<>'array' OR jsonb_typeof(staff_permissions)<>'object'
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(depts) v WHERE v NOT IN ('Satış','Kreatif','Müşteri İlişkileri','Muhasebe','Pazarlama','Yönetim'))
 OR EXISTS(SELECT 1 FROM jsonb_each(staff_permissions) v WHERE jsonb_typeof(v.value)<>'boolean' OR v.key NOT IN (
 'canPullLeads','canAddCustomer','canDeleteCustomer','canAssignConsultant','canChangeStage','canManageMetaConfig',
 'canEditProjectPrice','canChangeFlatStatus','canApproveDiscounts','canRefundDeposit','canManageTeam','canReshareFiles'))
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 UPDATE public.app_users SET department=dept,departments=depts,role=role_name,is_manager=role_name='MANAGER',scope=access_scope,permissions=staff_permissions WHERE id=p_id;
 UPDATE crm_backend.staff_accounts SET revision=revision+1 WHERE 'auth-'||auth_user_id::text=p_id;
 IF p_disable THEN UPDATE public.crm_identities SET active=false WHERE app_user_id=p_id; END IF;
 INSERT INTO crm_backend.staff_admin_audit(actor,target_id,operation) VALUES(auth.uid(),p_id,CASE WHEN p_disable THEN 'disable' ELSE 'update' END);
END $$;
REVOKE ALL ON FUNCTION public.crm_manage_staff(text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_manage_staff(text,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_update_own_profile(p_updates jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile();
BEGIN
 IF p_updates IS NULL OR jsonb_typeof(p_updates)<>'object' OR octet_length(p_updates::text)>300000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_updates) k WHERE k NOT IN ('fullName','avatarUrl'))
 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 IF p_updates ? 'fullName' AND length(btrim(coalesce(p_updates->>'fullName',''))) NOT BETWEEN 2 AND 150 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 UPDATE public.app_users SET full_name=coalesce(p_updates->>'fullName',full_name),avatar_url=CASE WHEN p_updates ? 'avatarUrl' THEN p_updates->>'avatarUrl' ELSE avatar_url END WHERE id=p->>'id';
END $$;
REVOKE ALL ON FUNCTION public.crm_update_own_profile(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_update_own_profile(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_staff_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'fullName',u.full_name,'username',u.username,
    'companyName',u.company_name,'department',u.department,'departments',u.departments,
    'role',u.role,'scope',u.scope,'isManager',u.is_manager,'permissions',u.permissions,'createdAt',u.created_at,'avatarUrl',u.avatar_url,'serverRevision',s.revision) ORDER BY u.full_name),'[]')
  INTO result FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
  LEFT JOIN crm_backend.staff_accounts s ON s.auth_user_id=i.auth_user_id
  WHERE i.active AND coalesce(u.company_name,'')=coalesce(p->>'company_name','');
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_staff_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_staff_directory() TO authenticated;

COMMIT;

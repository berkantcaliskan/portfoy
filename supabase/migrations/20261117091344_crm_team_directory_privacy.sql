BEGIN;

CREATE OR REPLACE FUNCTION public.crm_staff_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  profile jsonb := public.crm_get_my_profile();
  result jsonb;
BEGIN
  IF coalesce((profile->>'must_change_password')::boolean, true) THEN
    RETURN '[]'::jsonb;
  END IF;

  IF profile->>'role' = 'ADMIN' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', staff.id, 'fullName', staff.full_name, 'username', staff.username,
      'companyName', staff.company_name, 'department', staff.department, 'departments', staff.departments,
      'role', staff.role, 'scope', staff.scope, 'isManager', staff.is_manager, 'permissions', staff.permissions,
      'createdAt', staff.created_at, 'avatarUrl', staff.avatar_url, 'serverRevision', account.revision
    ) ORDER BY staff.full_name), '[]'::jsonb)
    INTO result
    FROM public.crm_identities AS identity
    JOIN public.app_users AS staff ON staff.id = identity.app_user_id
    LEFT JOIN crm_backend.staff_accounts AS account ON account.auth_user_id = identity.auth_user_id
    WHERE identity.active AND staff.company_name = profile->>'company_name';
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', staff.id, 'fullName', staff.full_name, 'username', staff.username, 'avatarUrl', staff.avatar_url,
      'department', CASE WHEN staff.username = 'berkant' THEN 'Pazarlama' ELSE staff.department END
    ) ORDER BY staff.full_name), '[]'::jsonb)
    INTO result
    FROM public.crm_identities AS identity
    JOIN public.app_users AS staff ON staff.id = identity.app_user_id
    WHERE identity.active AND staff.company_name = profile->>'company_name'
      AND staff.username <> 'staging-meta-admin';
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_staff_directory() TO authenticated;

CREATE OR REPLACE FUNCTION crm_backend.record_visible(p jsonb,m text,owner_id text,dept text,body jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(CASE
    WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
    WHEN m IN ('team_presence','team_assets','team_leaves') THEN p->>'role' = 'ADMIN'
    WHEN m='messages' THEN owner_id=p->>'id' OR body->>'recipientId'=p->>'id'
    WHEN m='calendar' THEN owner_id=p->>'id' OR body->>'visibilityScope'='COMPANY'
      OR (body->>'visibilityScope'='USERS' AND coalesce(body->'sharedUserIds','[]') ? (p->>'id'))
      OR (body->>'visibilityScope'='DEPARTMENT' AND coalesce(body->'sharedDepartments','[]') ? (p->>'department'))
    ELSE crm_backend.can_access(p,m,owner_id,dept,false)
  END, false)
$$;
REVOKE ALL ON FUNCTION crm_backend.record_visible(jsonb,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

DO $guard$
DECLARE
  original text := pg_get_functiondef('crm_backend.can_access(jsonb,text,text,text,boolean)'::regprocedure);
  role_branch text := 'WHEN p->>''role''=''ADMIN'' THEN true';
  team_branch text := 'WHEN m IN (''team_presence'',''team_assets'',''team_leaves'') AND p->>''role'' IS DISTINCT FROM ''ADMIN'' THEN false';
BEGIN
  IF position(team_branch IN original) = 0 THEN
    IF position(role_branch IN original) = 0 THEN
      RAISE EXCEPTION 'Portföy erişim kuralı beklenen biçimde değil.';
    END IF;
    EXECUTE replace(original, role_branch, team_branch || E'\n ' || role_branch);
  END IF;
END $guard$;

COMMIT;

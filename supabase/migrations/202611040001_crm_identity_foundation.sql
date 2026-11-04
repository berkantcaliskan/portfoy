-- Genel CRM Auth geçişinin temeli. Meta tablolarını/politikalarını değiştirmez.
-- Önce ayrı staging'de değerlendirin. Eski istemciyi otomatik etkinleştirmez.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_identities (
 auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 app_user_id text NOT NULL UNIQUE REFERENCES public.app_users(id),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_identities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crm_identities TO authenticated;
GRANT ALL ON public.crm_identities TO service_role;
DROP POLICY IF EXISTS crm_identity_self ON public.crm_identities;
CREATE POLICY crm_identity_self ON public.crm_identities FOR SELECT TO authenticated
 USING(auth_user_id=auth.uid());

-- Yalnızca var olan, yönetici tarafından doğrulanmış eşlemeyi devralır.
INSERT INTO public.crm_identities(auth_user_id,app_user_id)
 SELECT auth_user_id,app_user_id FROM public.meta_members WHERE app_user_id IS NOT NULL
 ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.crm_get_my_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
 SELECT jsonb_build_object(
  'auth_user_id',i.auth_user_id,'id',u.id,'full_name',u.full_name,'username',u.username,
  'email',u.email,'avatar_url',u.avatar_url,'company_name',u.company_name,
  'department',u.department,'departments',u.departments,'role',u.role,'scope',u.scope,
  'is_manager',u.is_manager,'permissions',u.permissions,'created_at',u.created_at)
 INTO result FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id
 WHERE i.auth_user_id=auth.uid() AND i.active;
 IF result IS NULL THEN RAISE EXCEPTION 'crm_identity_not_assigned' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_get_my_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_get_my_profile() TO authenticated,service_role;
COMMIT;

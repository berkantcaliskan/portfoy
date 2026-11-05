-- Mevcut yönetici kimliğiyle yalnızca profil ve boş backend listesi sözleşmesi.
-- E-posta/isim/şifre çıktılamaz. Bu, tarayıcı Auth kabulünün yerine geçmez.
BEGIN READ ONLY;
DO $$BEGIN
 PERFORM set_config('request.jwt.claim.sub',(SELECT i.auth_user_id::text FROM public.crm_identities i JOIN public.app_users u ON u.id=i.app_user_id WHERE i.active AND u.role='ADMIN' LIMIT 1),true);
END$$;
SET LOCAL ROLE authenticated;
SELECT jsonb_build_object(
 'verified_profile',(public.crm_get_my_profile()->>'auth_user_id')=auth.uid()::text,
 'profile_has_no_password',NOT (public.crm_get_my_profile() ? 'password'),
 'server_role_is_admin',(public.crm_get_my_profile()->>'role')='ADMIN',
 'project_list_valid',jsonb_typeof(public.crm_backend_list('projects')->'records')='array',
 'appointments_list_valid',jsonb_typeof(public.crm_backend_list('appointments')->'records')='array'
) AS checks;
-- CLI bağlantısı kapanınca READ ONLY işlem geri alınır; kalıcı yazım yoktur.

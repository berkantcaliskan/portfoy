-- Yanıtı kaybolmuş ilk personel oluşturma işlemi için dar kapsamlı kurtarma.
-- Kullanılmış/değiştirilmiş parolayı yeniden ayarlamaz; normal reset ayrı işlemdir.
BEGIN;
CREATE OR REPLACE FUNCTION public.crm_recover_staff_creation(p_creation_request uuid,p_reset_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); s crm_backend.staff_accounts%ROWTYPE; current_digest text;
BEGIN
 IF p->>'role'<>'ADMIN' OR p_reset_request IS NULL THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 SELECT * INTO s FROM crm_backend.staff_accounts WHERE request_id=p_creation_request AND created_by=auth.uid();
 IF NOT FOUND OR s.auth_user_id IS NULL OR s.company_name<>coalesce(p->>'company_name','') THEN RAISE EXCEPTION 'crm_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_staff_reset_actor:'||auth.uid()::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_staff_reset_target:auth-'||s.auth_user_id::text,0));
 SELECT encode(sha256(convert_to(encrypted_password,'UTF8')),'hex') INTO current_digest FROM auth.users WHERE id=s.auth_user_id;
 IF s.initial_password_digest IS NULL OR current_digest IS DISTINCT FROM s.initial_password_digest
 OR NOT EXISTS(SELECT 1 FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
   WHERE i.auth_user_id=s.auth_user_id AND u.must_change_password)
 THEN RAISE EXCEPTION 'crm_creation_already_used'; END IF;
 RETURN public.crm_staff_reset_target('auth-'||s.auth_user_id::text,p_reset_request);
END $$;
REVOKE ALL ON FUNCTION public.crm_recover_staff_creation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_recover_staff_creation(uuid,uuid) TO authenticated;
COMMIT;

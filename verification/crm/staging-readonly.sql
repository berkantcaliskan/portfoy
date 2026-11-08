-- Yalnızca yapısal/doğruluk sayımı. İsim, e-posta, kayıt içeriği veya sır göstermez.
SELECT jsonb_build_object(
 'identity_table_exists',to_regclass('public.crm_identities') IS NOT NULL,
 'identity_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.crm_identities'::regclass),
 'no_anon_identity',NOT has_table_privilege('anon','public.crm_identities','SELECT'),
 'no_identity_self_write',NOT has_table_privilege('authenticated','public.crm_identities','UPDATE'),
 'records_private',NOT has_schema_privilege('authenticated','crm_backend','USAGE'),
 'records_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='crm_backend.records'::regclass),
 'audit_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='crm_backend.write_audit'::regclass),
 'anonymous_rpc_denied',NOT has_function_privilege('anon','public.crm_backend_list(text,text,integer)','EXECUTE')
  AND NOT has_function_privilege('anon','public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean)','EXECUTE'),
 'all_module_writes_disabled',NOT EXISTS(SELECT 1 FROM crm_backend.module_settings WHERE write_enabled),
 'verified_identity_mapping',NOT EXISTS(SELECT 1 FROM public.crm_identities i LEFT JOIN public.app_users u ON u.id=i.app_user_id WHERE u.id IS NULL),
 'no_records_migrated',(SELECT count(*)=0 FROM crm_backend.records),
 'no_automatic_writes',(SELECT count(*)=0 FROM crm_backend.write_audit),
 'meta_settings_unchanged',(SELECT NOT enabled AND NOT auto_sync AND security_ready FROM public.meta_settings WHERE id=true),
 'meta_customer_count',(SELECT count(*) FROM public.leads),
 'meta_source_count',(SELECT count(*) FROM public.meta_lead_events),
 'meta_event_count',(SELECT count(*) FROM public.meta_outbox)
) AS checks;

BEGIN;
-- The deployed Auth rollout policies still called a service-role-only Meta
-- helper. Use the existing current-actor CRM helper, without broadening Meta RPC grants.
DROP POLICY IF EXISTS crm_lead_read ON public.leads;
CREATE POLICY crm_lead_read ON public.leads FOR SELECT TO authenticated
 USING(crm_backend.crm_can_access_lead(id,false));
DROP POLICY IF EXISTS crm_lead_update ON public.leads;
CREATE POLICY crm_lead_update ON public.leads FOR UPDATE TO authenticated
 USING(crm_backend.crm_can_access_lead(id,true))
 WITH CHECK(crm_backend.crm_can_access_lead(id,true));
DROP POLICY IF EXISTS crm_activity_read ON public.lead_activities;
CREATE POLICY crm_activity_read ON public.lead_activities FOR SELECT TO authenticated
 USING(crm_backend.crm_can_access_lead(lead_id,false));
DROP POLICY IF EXISTS crm_activity_insert ON public.lead_activities;
CREATE POLICY crm_activity_insert ON public.lead_activities FOR INSERT TO authenticated
 WITH CHECK(crm_backend.crm_can_access_lead(lead_id,true));
COMMIT;

SELECT
 NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('leads','lead_activities')
  AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%meta_can_read_lead%') AS musteri_izinleri_duzeldi,
 NOT has_function_privilege('authenticated','public.meta_can_read_lead(uuid,text)','EXECUTE') AS meta_sunucu_korumasi_aktif;

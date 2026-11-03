-- KORUMALI GEÇİŞ: yerel parola girişini kullanan eski istemcilerle uyumlu değildir.
-- Otomatik migration değildir. Yedek + Auth eşlemesi + staging kabulünden sonra yönetici uygular.
BEGIN;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.meta_members WHERE is_admin AND app_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Önce Supabase Auth ile doğrulanmış yönetici/personel eşlemesi oluşturun.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.meta_can_read_lead(p_user uuid,p_lead text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM meta_members m
    JOIN app_users u ON u.id=m.app_user_id JOIN leads l ON l.id=p_lead
    WHERE m.auth_user_id=p_user AND (
      m.is_admin OR u.role='ADMIN' OR u.scope='ALL' OR u.department='Yönetim'
      OR l.assigned_to_user_id=u.id
      OR (u.scope='DEPARTMENT' AND u.department='Müşteri İlişkileri')
      OR (u.scope='DEPARTMENT' AND u.department='Pazarlama' AND l.source='META_ADS')
    ))
$$;
REVOKE ALL ON FUNCTION public.meta_can_read_lead(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.meta_can_read_lead(uuid,text) TO authenticated,service_role;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('app_users','leads','lead_activities') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END $$;
REVOKE ALL ON public.app_users,public.leads,public.lead_activities FROM anon;
REVOKE ALL ON public.app_users FROM authenticated;
-- Parola sütunu API'den okunamaz. Kimlik doğrulama yalnızca Supabase Auth'tur.
GRANT SELECT(id,full_name,username,email,avatar_url,company_name,department,departments,role,is_manager,scope,permissions,created_at) ON public.app_users TO authenticated;
CREATE POLICY crm_profile_self ON public.app_users FOR SELECT TO authenticated
  USING(id IN (SELECT app_user_id FROM public.meta_members WHERE auth_user_id=auth.uid()));
-- Profil eşlemesine erişim yalnızca kişinin kendi kaydı için verilir, değişiklik hakkı verilmez.
GRANT SELECT ON public.meta_members TO authenticated;
DROP POLICY IF EXISTS meta_member_self ON public.meta_members;
CREATE POLICY meta_member_self ON public.meta_members FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
REVOKE INSERT,UPDATE ON public.leads FROM authenticated;
GRANT SELECT ON public.leads,public.lead_activities TO authenticated;
GRANT INSERT,UPDATE ON public.lead_activities TO authenticated;
-- Meta kimlikleri, inquiry atfı, stage/revision ve sunucu zamanları yalnızca doğrulanmış RPC'lerle yazılır.
GRANT INSERT(id,full_name,phone,secondary_phone,whatsapp_phone,email,source,form_name,channel,owner,tags,budget,
  preferred_housing_type,notes,assigned_to_user_id,assigned_to_user_name) ON public.leads TO authenticated;
GRANT UPDATE(full_name,phone,secondary_phone,whatsapp_phone,email,owner,tags,budget,preferred_housing_type,notes,
  assigned_to_user_id,assigned_to_user_name) ON public.leads TO authenticated;
CREATE POLICY crm_lead_read ON public.leads FOR SELECT TO authenticated USING(public.meta_can_read_lead(auth.uid(),id));
CREATE POLICY crm_lead_update ON public.leads FOR UPDATE TO authenticated
  USING(public.meta_can_read_lead(auth.uid(),id) AND EXISTS(SELECT 1 FROM public.meta_members WHERE auth_user_id=auth.uid() AND (can_send OR is_admin)))
  WITH CHECK(public.meta_can_read_lead(auth.uid(),id));
-- Yeni CRM müşterisi oluşturma yalnızca eşleştirilmiş yöneticiye bırakılır; webhook service_role RPC kullanır.
CREATE POLICY crm_lead_insert ON public.leads FOR INSERT TO authenticated
  WITH CHECK(EXISTS(SELECT 1 FROM public.meta_members WHERE auth_user_id=auth.uid() AND is_admin));
CREATE POLICY crm_activity_read ON public.lead_activities FOR SELECT TO authenticated USING(public.meta_can_read_lead(auth.uid(),lead_id));
CREATE POLICY crm_activity_insert ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK(public.meta_can_read_lead(auth.uid(),lead_id));
-- app_users, leads ve activities için DELETE politikası verilmez.
COMMIT;

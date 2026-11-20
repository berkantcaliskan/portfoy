BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.lead_workspace (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  company_name text NOT NULL CHECK (btrim(company_name) <> '')
);
REVOKE ALL ON crm_backend.lead_workspace FROM PUBLIC, anon, authenticated;

-- Lead rows have no company column. Require one company owned by verified active CRM administrators.
DO $$
DECLARE
  company text;
  company_count int;
BEGIN
  SELECT min(u.company_name), count(DISTINCT u.company_name)
    INTO company, company_count
  FROM public.crm_identities i
  JOIN public.app_users u ON u.id = i.app_user_id
  WHERE i.active AND u.role = 'ADMIN' AND NOT u.must_change_password
    AND btrim(u.company_name) <> '';

  IF company_count <> 1 OR EXISTS (
    SELECT 1 FROM crm_backend.lead_workspace WHERE company_name <> company
  ) THEN
    RAISE EXCEPTION 'CRM lead workspace requires one verified company';
  END IF;
  INSERT INTO crm_backend.lead_workspace (company_name) VALUES (company) ON CONFLICT DO NOTHING;
END $$;


-- Assigned secondary workspaces can read existing department data.
-- Their primary-department write permissions, handover rules and company boundary are preserved.
CREATE OR REPLACE FUNCTION crm_backend.can_access(p jsonb,m text,owner_id text,dept text,writing boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE
 WHEN coalesce((p->>'must_change_password')::boolean,false) THEN false
 WHEN m NOT IN ('projects','appointments','requests','collections','payments','approvals','files','contacts','properties','creative_schedule','creative_assets','creative_comments','creative_briefs','calendar','calendar_overrides','brand_kit','messages') THEN false
 WHEN p->>'role'='ADMIN' THEN true
 WHEN m IN ('collections','payments') THEN p->>'department'='Muhasebe'
 WHEN m='projects' THEN NOT writing OR (p->>'role'='MANAGER' AND p->>'department' IN ('Satış','Yönetim')) OR p->'permissions'->>'canChangeFlatStatus'='true' OR p->'permissions'->>'canEditProjectPrice'='true'
 WHEN m='calendar' THEN owner_id=p->>'id'
 WHEN m='calendar_overrides' THEN owner_id=p->>'id'
 WHEN m='messages' THEN owner_id=p->>'id'
 WHEN m='brand_kit' THEN NOT writing OR p->>'department' IN ('Kreatif','Pazarlama','Yönetim')
 WHEN m='contacts' THEN owner_id=p->>'id'
 WHEN m='properties' THEN NOT writing OR owner_id=p->>'id' OR (p->>'role'='MANAGER' AND p->>'department'='Satış')
 WHEN m IN ('creative_schedule','creative_assets','creative_comments','creative_briefs') THEN
   (NOT writing AND coalesce(p->'departments','[]') ? 'Kreatif') OR p->>'department' IN ('Kreatif','Pazarlama','Yönetim') OR (owner_id=p->>'id' AND m IN ('creative_briefs','creative_comments'))
 WHEN m='files' THEN owner_id=p->>'id'
 WHEN m='approvals' THEN owner_id=p->>'id' OR (p->>'role'='MANAGER' AND p->>'department'='Yönetim')
 ELSE owner_id=p->>'id' OR (p->>'scope'='DEPARTMENT' AND p->>'role'='MANAGER' AND dept=p->>'department')
 END,false)
$$;
REVOKE ALL ON FUNCTION crm_backend.can_access(jsonb,text,text,text,boolean) FROM PUBLIC,anon,authenticated;



CREATE OR REPLACE FUNCTION crm_backend.crm_can_access_lead(p_id text, p_write boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_identities i
    JOIN public.app_users u ON u.id = i.app_user_id
    JOIN crm_backend.lead_workspace w ON w.company_name = u.company_name
    JOIN public.leads l ON l.id = p_id
    WHERE i.auth_user_id = auth.uid() AND i.active AND NOT u.must_change_password
      AND CASE
        WHEN u.role = 'ADMIN' OR u.department = 'Yönetim' THEN true
        WHEN u.department = 'Müşteri İlişkileri' THEN
          u.scope IN ('ALL', 'DEPARTMENT') OR l.assigned_to_user_id = u.id
        WHEN u.department = 'Pazarlama' THEN NOT p_write
          AND l.source IN ('META_ADS', 'FACEBOOK', 'INSTAGRAM')
          AND (u.scope IN ('ALL', 'DEPARTMENT') OR l.assigned_to_user_id = u.id)
        WHEN (u.department = 'Satış' OR coalesce(u.departments,'[]'::jsonb) ? 'Satış') THEN NOT p_write AND EXISTS (
          SELECT 1 FROM (
            SELECT item
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.assignment_history) = 'array'
              THEN l.assignment_history ELSE '[]'::jsonb END) WITH ORDINALITY a(item, position)
            WHERE jsonb_typeof(item->'isSalesHandover') = 'boolean'
            ORDER BY position LIMIT 1
          ) h
          WHERE h.item->>'isSalesHandover' = 'true'
            AND (u.scope IN ('ALL', 'DEPARTMENT') OR h.item->>'assignedToUserId' IN (u.id, 'ALL_SALES'))
        )
        ELSE NOT p_write AND l.assigned_to_user_id = u.id
      END
  )
$$;
REVOKE ALL ON FUNCTION crm_backend.crm_can_access_lead(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_backend.crm_can_access_lead(text, boolean) TO authenticated;


ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.leads,public.lead_activities TO authenticated;
-- Separate read policies for verified CRM staff. Existing Meta policies/functions stay unchanged.
DROP POLICY IF EXISTS crm_assigned_staff_lead_read ON public.leads;
CREATE POLICY crm_assigned_staff_lead_read ON public.leads FOR SELECT TO authenticated USING (crm_backend.crm_can_access_lead(id,false));
DROP POLICY IF EXISTS crm_assigned_staff_activity_read ON public.lead_activities;
CREATE POLICY crm_assigned_staff_activity_read ON public.lead_activities FOR SELECT TO authenticated USING (crm_backend.crm_can_access_lead(lead_id,false));
COMMIT;

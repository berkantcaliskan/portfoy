-- Müşteriye çıkış sırası: satışçılar sırayla müşteriye çıkar.
-- Herkes okuyabilir; en son çıkanı Ön Ofis (veya admin) işaretler, sıradaki kişi ondan sonraki olur.
BEGIN;
CREATE TABLE IF NOT EXISTS crm_backend.sales_rotation(
 company_name text PRIMARY KEY,
 member_ids jsonb NOT NULL CHECK(jsonb_typeof(member_ids)='array'),
 last_id text,
 revision bigint NOT NULL CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by text
);
ALTER TABLE crm_backend.sales_rotation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.sales_rotation FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_rotation_get() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); r crm_backend.sales_rotation%ROWTYPE; ids jsonb;
BEGIN
 SELECT * INTO r FROM crm_backend.sales_rotation WHERE company_name=p->>'company_name';
 IF FOUND THEN
  ids:=r.member_ids;
 ELSE
  -- İlk sıra: Hazal, Ertuğrul, Levent (yönetici sonradan güncelleyebilir)
  SELECT coalesce(jsonb_agg(u.id ORDER BY d.ord),'[]'::jsonb) INTO ids
  FROM unnest(ARRAY['Hazal Çetin','Ertuğrul Sezer','Levent Balcı']) WITH ORDINALITY AS d(name,ord)
  JOIN public.app_users u ON u.full_name=d.name AND u.company_name=p->>'company_name'
  JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active;
 END IF;
 RETURN jsonb_build_object(
  'revision',coalesce(r.revision,0),
  'lastId',r.last_id,
  'updatedAt',r.updated_at,
  'updatedBy',(SELECT u.full_name FROM public.app_users u WHERE u.id=r.updated_by),
  'canMark',crm_backend.office_allowed(p),
  'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) ORDER BY e.ord),'[]'::jsonb)
   FROM jsonb_array_elements_text(ids) WITH ORDINALITY AS e(id,ord)
   JOIN public.app_users u ON u.id=e.id AND u.company_name=p->>'company_name'));
END $$;

CREATE OR REPLACE FUNCTION public.crm_rotation_mark(p_last text,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); cur jsonb; ids jsonb;
BEGIN
 IF NOT crm_backend.office_allowed(p) THEN RAISE EXCEPTION 'rotation_forbidden'; END IF;
 IF p_last IS NULL OR p_revision IS NULL OR p_revision<0 THEN RAISE EXCEPTION 'rotation_invalid'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rotation:'||(p->>'company_name'),6));
 cur:=public.crm_rotation_get();
 IF (cur->>'revision')::bigint<>p_revision THEN RAISE EXCEPTION 'rotation_conflict'; END IF;
 SELECT coalesce(jsonb_agg(m->>'id'),'[]'::jsonb) INTO ids FROM jsonb_array_elements(cur->'members') m;
 IF NOT (ids ? p_last) THEN RAISE EXCEPTION 'rotation_invalid'; END IF;
 INSERT INTO crm_backend.sales_rotation(company_name,member_ids,last_id,revision,updated_by)
 VALUES(p->>'company_name',ids,p_last,1,p->>'id')
 ON CONFLICT(company_name) DO UPDATE SET member_ids=excluded.member_ids,last_id=excluded.last_id,
  revision=crm_backend.sales_rotation.revision+1,updated_at=now(),updated_by=excluded.updated_by;
 RETURN public.crm_rotation_get();
END $$;

REVOKE ALL ON FUNCTION public.crm_rotation_get(),public.crm_rotation_mark(text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_rotation_get(),public.crm_rotation_mark(text,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

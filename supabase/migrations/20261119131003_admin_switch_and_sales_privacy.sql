BEGIN;
-- A project remains readable as inventory, but another employee's sales attribution is private.
CREATE OR REPLACE FUNCTION crm_backend.project_visible_payload(p jsonb,body jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE unit jsonb; history jsonb; result jsonb:='[]'; own boolean;
BEGIN
 IF p->>'role'='ADMIN' OR jsonb_typeof(body->'units') IS DISTINCT FROM 'array' THEN RETURN body; END IF;
 FOR unit IN SELECT value FROM jsonb_array_elements(body->'units') LOOP
  own:=unit->'sale'->>'soldByUserId'=p->>'id' OR (nullif(unit->'sale'->>'soldByUserId','') IS NULL AND unit->'sale'->>'soldByUserName'=p->>'full_name');
  IF jsonb_typeof(unit->'sale')='object' AND NOT coalesce(own,false) THEN unit:=jsonb_set(unit,'{sale}',unit->'sale'-'soldByUserId'-'soldByUserName'); END IF;
  IF jsonb_typeof(unit->'history')='array' THEN
   SELECT coalesce(jsonb_agg(CASE WHEN h->>'changedByUserId'=p->>'id' THEN h ELSE h-'changedByUserId'-'changedByUserName' END ORDER BY n),'[]') INTO history
    FROM jsonb_array_elements(unit->'history') WITH ORDINALITY a(h,n);
   unit:=jsonb_set(unit,'{history}',history);
  END IF;
  result:=result||jsonb_build_array(unit);
 END LOOP;
 RETURN jsonb_set(body,'{units}',result);
END $$;
REVOKE ALL ON FUNCTION crm_backend.project_visible_payload(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

-- Preserve existing validated writers and lists behind non-exposed private functions.
DO $$ BEGIN
 IF to_regprocedure('crm_backend.list_before_sales_privacy(text,text,integer)') IS NULL THEN
  ALTER FUNCTION public.crm_backend_list(text,text,integer) SET SCHEMA crm_backend;
  ALTER FUNCTION crm_backend.crm_backend_list(text,text,integer) RENAME TO list_before_sales_privacy;
 END IF;
 IF to_regprocedure('crm_backend.write_before_sales_privacy(uuid,text,text,bigint,jsonb,boolean)') IS NULL THEN
  ALTER FUNCTION public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) SET SCHEMA crm_backend;
  ALTER FUNCTION crm_backend.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) RENAME TO write_before_sales_privacy;
 END IF;
END $$;
REVOKE ALL ON FUNCTION crm_backend.list_before_sales_privacy(text,text,integer),crm_backend.write_before_sales_privacy(uuid,text,text,bigint,jsonb,boolean) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.crm_backend_list(p_module text,p_after text DEFAULT '',p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb; rows jsonb;
BEGIN
 result:=crm_backend.list_before_sales_privacy(p_module,p_after,p_limit);
 IF p_module='projects' AND p->>'role'<>'ADMIN' THEN
  SELECT coalesce(jsonb_agg(jsonb_set(r,'{payload}',crm_backend.project_visible_payload(p,r->'payload')) ORDER BY n),'[]') INTO rows
  FROM jsonb_array_elements(result->'records') WITH ORDINALITY a(r,n);
  result:=jsonb_set(result,'{records}',rows);
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.crm_backend_write(p_request uuid,p_module text,p_id text,p_revision bigint,p_payload jsonb,p_archive boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb; prior jsonb; unit jsonb; old_unit jsonb; units jsonb:='[]';
BEGIN
 IF p_module='brand_kit' AND p->>'role'<>'ADMIN' THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
 IF p_module='projects' AND p->>'role'<>'ADMIN' AND jsonb_typeof(p_payload->'units')='array' THEN
  SELECT payload INTO prior FROM crm_backend.records WHERE module='projects' AND id=p_id AND company_name=p->>'company_name';
  FOR unit IN SELECT value FROM jsonb_array_elements(p_payload->'units') LOOP
   SELECT value INTO old_unit FROM jsonb_array_elements(coalesce(prior->'units','[]')) WHERE value->>'id'=unit->>'id';
   IF jsonb_typeof(old_unit->'sale')='object' AND old_unit->'sale'->>'soldByUserId' IS DISTINCT FROM p->>'id' AND jsonb_typeof(unit->'sale')='object' THEN
    unit:=jsonb_set(unit,'{sale}',unit->'sale'||jsonb_strip_nulls(jsonb_build_object('soldByUserId',old_unit->'sale'->>'soldByUserId','soldByUserName',old_unit->'sale'->>'soldByUserName')));
   END IF;
   units:=units||jsonb_build_array(unit);
  END LOOP;
  p_payload:=jsonb_set(p_payload,'{units}',units);
 END IF;
 result:=crm_backend.write_before_sales_privacy(p_request,p_module,p_id,p_revision,p_payload,p_archive);
 IF p_module='projects' THEN result:=jsonb_set(result,'{payload}',crm_backend.project_visible_payload(p,result->'payload')); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_backend_list(text,text,integer),public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_backend_list(text,text,integer),public.crm_backend_write(uuid,text,text,bigint,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_sales_performance(p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.crm_get_my_profile(); result jsonb;
BEGIN
 IF coalesce((p->>'must_change_password')::boolean,true) OR (p->>'role'<>'ADMIN' AND p->>'department'<>'Satış' AND NOT coalesce(p->'departments','[]') ? 'Satış') THEN RAISE EXCEPTION 'crm_forbidden' USING ERRCODE='42501'; END IF;
 IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
 WITH staff AS (SELECT u.id,u.full_name,u.department FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active WHERE u.company_name=p->>'company_name'),
 sales AS (SELECT coalesce(nullif(unit->'sale'->>'soldByUserId',''),(SELECT min(s.id) FROM staff s WHERE s.full_name=unit->'sale'->>'soldByUserName' HAVING count(*)=1),'legacy-'||coalesce(unit->'sale'->>'soldByUserName','unassigned')) id,
  coalesce(unit->'sale'->>'soldByUserName','Danışmanı belirtilmemiş') name
 FROM crm_backend.records r CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.payload->'units')='array' THEN r.payload->'units' ELSE '[]' END) unit
 WHERE r.module='projects' AND NOT r.deleted AND r.company_name=p->>'company_name' AND unit->>'status'='SATILDI'
 AND (p_from IS NULL OR (unit->'sale'->>'soldAt')::timestamptz>=p_from) AND (p_to IS NULL OR (unit->'sale'->>'soldAt')::timestamptz<=p_to)),
 counts AS (SELECT id,max(name) name,count(*)::integer count FROM sales GROUP BY id),
 people AS (SELECT id,full_name name FROM staff WHERE department='Satış' UNION SELECT id,name FROM counts WHERE id NOT IN (SELECT id FROM staff WHERE department='Satış')),
 ranked AS (SELECT s.id,s.name,coalesce(c.count,0) count,CASE WHEN p->>'role'='ADMIN' THEN CASE WHEN (SELECT count(*) FROM sales)>0 THEN round(coalesce(c.count,0)*100.0/(SELECT count(*) FROM sales),1) ELSE 0 END ELSE 0 END percentage
 FROM people s LEFT JOIN counts c ON c.id=s.id WHERE p->>'role'='ADMIN' OR s.id=p->>'id')
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.count DESC,r.name),'[]') INTO result FROM ranked r;
 RETURN jsonb_build_object('comparison',p->>'role'='ADMIN','rows',result);
END $$;
REVOKE ALL ON FUNCTION public.crm_sales_performance(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_sales_performance(timestamptz,timestamptz) TO authenticated;

CREATE TABLE IF NOT EXISTS crm_backend.creative_code_counters(company_name text NOT NULL,year integer NOT NULL,last_number integer NOT NULL CHECK(last_number BETWEEN 1 AND 999999),PRIMARY KEY(company_name,year));
ALTER TABLE crm_backend.creative_code_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.creative_code_counters FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION crm_backend.assign_creative_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE yr integer; seq integer; suffix text; existing jsonb;
BEGIN
 IF NEW.module<>'creative_assets' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  NEW.payload:=jsonb_set(NEW.payload,'{code}',OLD.payload->'code');
  RETURN NEW;
 END IF;
 yr:=extract(year FROM clock_timestamp() AT TIME ZONE 'Europe/Istanbul');
 INSERT INTO crm_backend.creative_code_counters(company_name,year,last_number) VALUES(NEW.company_name,yr,1)
 ON CONFLICT(company_name,year) DO UPDATE SET last_number=crm_backend.creative_code_counters.last_number+1 RETURNING last_number INTO seq;
 suffix:=CASE NEW.payload->>'mediaType' WHEN 'VIDEO' THEN 'V' WHEN 'PHOTO' THEN 'F' WHEN 'GIF' THEN 'G' WHEN 'AUDIO' THEN 'A' WHEN 'PDF' THEN 'P' ELSE 'D' END;
 NEW.payload:=NEW.payload||jsonb_build_object('code','KRE/'||yr::text||lpad(seq::text,6,'0')||suffix,'createdAt',clock_timestamp());
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.assign_creative_code() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS a_crm_assign_creative_code ON crm_backend.records;
CREATE TRIGGER a_crm_assign_creative_code BEFORE INSERT OR UPDATE ON crm_backend.records FOR EACH ROW EXECUTE FUNCTION crm_backend.assign_creative_code();
COMMIT;

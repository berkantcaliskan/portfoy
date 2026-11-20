CREATE TABLE crm_backend.personal_tools (
  owner_id text NOT NULL REFERENCES public.app_users(id), field text NOT NULL, value jsonb NOT NULL,
  PRIMARY KEY(owner_id,field)
);
CREATE TABLE crm_backend.accounting_archive (
  id uuid PRIMARY KEY, company text NOT NULL, parent_id uuid REFERENCES crm_backend.accounting_archive(id),
  folder boolean NOT NULL, name text NOT NULL, category text NOT NULL, customer text NOT NULL,
  shelf text NOT NULL, bytes bytea, created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id), CHECK(folder=(bytes IS NULL))
);
CREATE UNIQUE INDEX accounting_archive_folder_name ON crm_backend.accounting_archive
(company,coalesce(parent_id::text,''),lower(name)) WHERE folder;
ALTER TABLE crm_backend.personal_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.accounting_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.personal_tools,crm_backend.accounting_archive FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.crm_tools_read(p_owner text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=crm_backend.office_profile();
BEGIN
 IF p_owner IS DISTINCT FROM actor->>'id' THEN RAISE EXCEPTION 'tool_forbidden'; END IF;
 RETURN (SELECT coalesce(jsonb_object_agg(field,value),'{}') FROM crm_backend.personal_tools WHERE owner_id=p_owner);
END $$;
CREATE FUNCTION public.crm_tools_save(p_owner text,p_patch jsonb,p_base jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb:=crm_backend.office_profile(); pair record; old jsonb;
BEGIN
 IF p_owner IS DISTINCT FROM actor->>'id' THEN RAISE EXCEPTION 'tool_forbidden'; END IF;
 IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_base) IS DISTINCT FROM 'object'
  OR octet_length(p_patch::text)>2000000 OR octet_length(p_base::text)>2000000 THEN RAISE EXCEPTION 'tool_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner,77));
 FOR pair IN SELECT * FROM jsonb_each(p_patch) LOOP
  IF pair.key !~ '^[A-Za-z][A-Za-z0-9_]{0,90}$' THEN RAISE EXCEPTION 'tool_invalid'; END IF;
  SELECT value INTO old FROM crm_backend.personal_tools WHERE owner_id=p_owner AND field=pair.key;
  IF old IS DISTINCT FROM p_base->pair.key AND old IS DISTINCT FROM pair.value THEN RETURN false; END IF;
 END LOOP;
 INSERT INTO crm_backend.personal_tools(owner_id,field,value) SELECT p_owner,key,value FROM jsonb_each(p_patch)
 ON CONFLICT(owner_id,field) DO UPDATE SET value=excluded.value;
 RETURN true;
END $$;
CREATE FUNCTION crm_backend.archive_company() RETURNS text LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile();
BEGIN
 IF NOT coalesce(p->>'role'='ADMIN' OR p->>'department'='Muhasebe' OR p->'departments' ? 'Muhasebe',false)
 THEN RAISE EXCEPTION 'archive_forbidden'; END IF;
 RETURN p->>'company_name';
END $$;
CREATE FUNCTION public.crm_archive_list(p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM (
 SELECT id,parent_id,folder,name,category,customer,shelf,created_at,coalesce(octet_length(bytes),0) AS size
 FROM crm_backend.accounting_archive WHERE company=crm_backend.archive_company() AND (p_after IS NULL OR id>p_after)
 ORDER BY id LIMIT 200)a
$$;
CREATE FUNCTION public.crm_archive_file(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(bytes,'base64') FROM crm_backend.accounting_archive WHERE id=p_id AND company=crm_backend.archive_company() AND NOT folder
$$;
CREATE FUNCTION public.crm_archive_add(p_id uuid,p_parent uuid,p_name text,p_category text,p_customer text,p_shelf text,p_folder boolean,p_file text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org text:=crm_backend.archive_company(); content bytea; prior crm_backend.accounting_archive%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_folder IS NULL OR nullif(btrim(p_name),'') IS NULL OR length(p_name)>240 OR (p_folder IS DISTINCT FROM (p_file IS NULL))
 OR length(p_file)>11184812 OR greatest(length(p_category),length(p_shelf),length(p_customer))>300 THEN RAISE EXCEPTION 'archive_invalid';END IF;
 IF p_parent IS NOT NULL AND NOT EXISTS(SELECT FROM crm_backend.accounting_archive WHERE id=p_parent AND company=org AND folder) THEN RAISE EXCEPTION 'archive_forbidden';END IF;
 content:=decode(p_file,'base64');
 IF octet_length(content)>8388608 OR octet_length(content)=0 THEN RAISE EXCEPTION 'archive_invalid';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,78));
 SELECT * INTO prior FROM crm_backend.accounting_archive WHERE id=p_id;
 IF FOUND THEN
  IF prior.company=org AND prior.created_by=auth.uid() AND prior.parent_id IS NOT DISTINCT FROM p_parent
   AND prior.name=btrim(p_name) AND prior.folder=p_folder AND prior.category=coalesce(p_category,'') AND prior.shelf=coalesce(p_shelf,'')
   AND prior.customer=coalesce(p_customer,'') AND sha256(prior.bytes) IS NOT DISTINCT FROM sha256(content) THEN RETURN p_id; END IF;
  RAISE EXCEPTION 'archive_conflict';
 END IF;
 INSERT INTO crm_backend.accounting_archive(id,company,parent_id,name,category,customer,shelf,folder,bytes,created_by)
 VALUES(p_id,org,p_parent,btrim(p_name),coalesce(p_category,''),coalesce(p_customer,''),coalesce(p_shelf,''),p_folder,content,auth.uid());
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION crm_backend.archive_company(),public.crm_tools_read(text),public.crm_tools_save(text,jsonb,jsonb),
 public.crm_archive_list(uuid), public.crm_archive_file(uuid),public.crm_archive_add(uuid,uuid,text,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_tools_read(text),public.crm_tools_save(text,jsonb,jsonb),
 public.crm_archive_list(uuid),public.crm_archive_file(uuid),public.crm_archive_add(uuid,uuid,text,text,text,text,boolean,text) TO authenticated;

-- Keep the existing manual lead validation, assignment and receipt in the same transaction.
CREATE FUNCTION public.crm_manual_lead_channel(p_request uuid,p_payload jsonb,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rec jsonb; modified jsonb;
BEGIN
 IF p_channel IS NULL OR p_channel NOT IN ('Direkt','Sahibinden','Hepsiemlak') THEN RAISE EXCEPTION 'crm_manual_lead_invalid';END IF;
 rec:=public.crm_create_manual_lead(p_request,p_payload);
 IF rec->>'channel'=p_channel THEN RETURN rec; END IF;
 IF rec->>'source' IS DISTINCT FROM 'DIRECT' OR rec->>'id' IS DISTINCT FROM 'crm-manual-'||p_request::text
 OR rec->>'channel' IS DISTINCT FROM 'Manuel Kayıt' THEN RAISE EXCEPTION 'crm_manual_lead_conflict'; END IF;
 UPDATE public.leads l SET channel=p_channel,inquiries=jsonb_set(l.inquiries,'{0,channel}',to_jsonb(p_channel))
 WHERE l.id=rec->>'id' AND l.source='DIRECT' AND l.channel='Manuel Kayıt' RETURNING to_jsonb(l) INTO modified;
 IF modified IS NULL THEN RAISE EXCEPTION 'crm_manual_lead_conflict'; END IF;
 UPDATE crm_backend.manual_lead_requests SET result=modified WHERE actor=auth.uid() AND request_id=p_request;
 RETURN modified;
END $$;
REVOKE ALL ON FUNCTION public.crm_manual_lead_channel(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_manual_lead_channel(uuid,jsonb,text) TO authenticated;

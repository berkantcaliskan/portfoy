-- Document bytes are read on demand. The existing office record owns the permanent contract number.
CREATE TABLE crm_backend.contract_documents (
  record_id uuid PRIMARY KEY REFERENCES crm_backend.office_records(id) ON DELETE CASCADE,
  lead_id text UNIQUE REFERENCES public.leads(id) ON DELETE SET NULL,
  advisor_id text,
  format text NOT NULL CHECK(format IN ('template-v1','docx','pdf','legacy')),
  fields jsonb NOT NULL DEFAULT '{}',
  attachment bytea
);
CREATE TABLE crm_backend.contract_operations (
  actor uuid NOT NULL, request uuid NOT NULL, signature bytea NOT NULL,
  record_id uuid NOT NULL, revision bigint NOT NULL, PRIMARY KEY(actor,request)
);
ALTER TABLE crm_backend.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_backend.contract_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.contract_documents,crm_backend.contract_operations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION crm_backend.contract_office(p jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT crm_backend.office_allowed(p) OR p->>'department' IN ('Ön Ofis','Muhasebe','Yönetim')
 OR coalesce(p->'departments','[]') ?| ARRAY['Ön Ofis','Muhasebe','Yönetim']
$$;
CREATE FUNCTION crm_backend.contract_sales(p jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT p->>'department'='Satış' OR coalesce(p->'departments','[]') ? 'Satış'
$$;
CREATE FUNCTION crm_backend.contract_assignee(l public.leads) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce((SELECT CASE WHEN h->>'isSalesHandover'='true' THEN h->>'assignedToUserId' ELSE '' END
 FROM jsonb_array_elements(coalesce(l.assignment_history,'[]')) WITH ORDINALITY a(h,n)
 WHERE jsonb_typeof(h->'isSalesHandover')='boolean' ORDER BY n LIMIT 1),l.assigned_to_user_id,'')
$$;
CREATE FUNCTION crm_backend.contract_customer_ok(p jsonb, customer text, advisor text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM public.leads l JOIN crm_backend.lead_workspace w ON w.company_name=p->>'company_name'
 WHERE l.id=customer AND NOT EXISTS(SELECT FROM crm_backend.lead_archives a WHERE a.lead_id=l.id)
 AND (crm_backend.contract_office(p) OR (crm_backend.contract_sales(p) AND
 (crm_backend.contract_assignee(l)=p->>'id' OR (crm_backend.contract_assignee(l)='ALL_SALES' AND advisor=p->>'id')))))
$$;
CREATE FUNCTION crm_backend.contract_reader(p jsonb, customer text, advisor text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT crm_backend.contract_office(p) OR (crm_backend.contract_sales(p) AND advisor=p->>'id') OR crm_backend.contract_customer_ok(p,customer,advisor)
$$;
CREATE FUNCTION public.crm_contract_customers(p_query text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile();
BEGIN
 IF NOT crm_backend.contract_office(p) THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM (SELECT l.id, l.full_name AS name,l.phone,crm_backend.contract_assignee(l) AS advisor
 FROM public.leads l JOIN crm_backend.lead_workspace w ON w.company_name=p->>'company_name'
 WHERE (l.full_name ILIKE '%'||left(p_query,100)||'%' OR l.phone ILIKE '%'||left(p_query,100)||'%')
 AND NOT EXISTS(SELECT FROM crm_backend.lead_archives a WHERE a.lead_id=l.id)
 ORDER BY l.full_name,l.id LIMIT 50)c);
END $$;
CREATE FUNCTION public.crm_contract_list(p_lead text DEFAULT NULL,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile();
BEGIN
 IF NOT crm_backend.contract_office(p) AND NOT crm_backend.contract_sales(p) THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY rows.id),'[]') FROM (
 SELECT r.id,r.revision,r.updated_at,r.payload->>'contractNumber' AS number,r.payload->>'name' AS name,
 r.payload->>'title' AS title,r.payload->>'status' AS status,r.payload->>'visitorId' AS visitor_id,d.lead_id,coalesce(d.format,'legacy') AS format
 FROM crm_backend.office_records r LEFT JOIN crm_backend.contract_documents d ON d.record_id=r.id
 WHERE r.kind='contracts' AND r.company_name=p->>'company_name' AND (p_lead IS NULL OR d.lead_id=p_lead)
 AND (p_after IS NULL OR r.id>p_after) AND crm_backend.contract_reader(p,d.lead_id,d.advisor_id)
 ORDER BY r.id LIMIT 100)rows);
END $$;
CREATE FUNCTION public.crm_contract_open(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); result jsonb;
BEGIN
 SELECT jsonb_build_object('id',r.id,'revision',r.revision,'number',r.payload->>'contractNumber','name',r.payload->>'name',
 'status',r.payload->>'status','title',r.payload->>'title','lead_id',d.lead_id,'advisor_id',d.advisor_id,'format',coalesce(d.format,'legacy'),
 'fields',coalesce(d.fields,r.payload),'file',encode(d.attachment,'base64')) INTO result
 FROM crm_backend.office_records r LEFT JOIN crm_backend.contract_documents d ON d.record_id=r.id WHERE r.id=p_id
 AND r.kind='contracts' AND r.company_name=p->>'company_name' AND crm_backend.contract_reader(p,d.lead_id,d.advisor_id);
 IF result IS NULL THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.crm_contract_write(p_request uuid,p_id uuid,p_revision bigint,p_doc jsonb,p_file text DEFAULT NULL,p_delete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=crm_backend.office_profile(); old crm_backend.office_records%ROWTYPE; doc crm_backend.contract_documents%ROWTYPE;
 prior crm_backend.contract_operations%ROWTYPE; sig bytea; customer text:=nullif(p_doc->>'lead_id',''); advisor text:=nullif(p_doc->>'advisor_id','');
 fmt text:=p_doc->>'format'; fields jsonb:=p_doc->'fields'; meta jsonb; bytes bytea; rev bigint; existing boolean;
BEGIN
 IF p_request IS NULL OR p_id IS NULL OR p_revision IS NULL OR p_revision<0 OR p_delete IS NULL OR p_doc IS NULL
 OR octet_length(p_doc::text)>180000 OR length(p_file)>11184812 THEN RAISE EXCEPTION 'contract_invalid'; END IF;
 IF NOT crm_backend.contract_office(p) AND NOT crm_backend.contract_sales(p) THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
 sig:=sha256(convert_to(jsonb_build_array(p_id,p_revision,p_doc,p_delete)::text,'UTF8')||sha256(convert_to(coalesce(p_file,''),'UTF8')));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,12));
 SELECT * INTO prior FROM crm_backend.contract_operations WHERE actor=auth.uid() AND request=p_request;
 IF FOUND THEN
  IF prior.signature<>sig THEN RAISE EXCEPTION 'contract_conflict'; END IF;
  RETURN jsonb_build_object('id',prior.record_id,'revision',prior.revision);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,13));
 SELECT * INTO old FROM crm_backend.office_records WHERE id=p_id FOR UPDATE; existing:=FOUND;
 IF existing THEN
  SELECT * INTO doc FROM crm_backend.contract_documents WHERE record_id=p_id;
  IF old.company_name<>p->>'company_name' OR old.kind<>'contracts' OR NOT coalesce(crm_backend.contract_reader(p,doc.lead_id,doc.advisor_id),false)
   THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
  IF old.revision<>p_revision THEN RAISE EXCEPTION 'contract_conflict'; END IF;
 ELSIF p_revision<>0 OR p_delete THEN RAISE EXCEPTION 'contract_conflict'; END IF;
 rev:=p_revision+1;
 IF p_delete THEN
  DELETE FROM crm_backend.office_records WHERE id=p_id;
 ELSE
  IF jsonb_typeof(fields) IS DISTINCT FROM 'object' OR fmt IS NULL OR fmt NOT IN ('template-v1','pdf','docx','legacy')
    OR nullif(btrim(p_doc->>'name'),'') IS NULL OR length(p_doc->>'name')>500 OR coalesce(p_doc->>'status','') NOT IN ('DRAFT','READY','SIGNED')
    OR (fmt='legacy' AND NOT existing) THEN RAISE EXCEPTION 'contract_invalid'; END IF;
  IF existing AND doc.lead_id IS NOT NULL AND customer IS DISTINCT FROM doc.lead_id THEN RAISE EXCEPTION 'contract_conflict'; END IF;
  IF NOT crm_backend.contract_office(p) THEN advisor:=CASE WHEN existing THEN doc.advisor_id ELSE p->>'id' END; END IF;
  IF (NOT existing OR customer IS DISTINCT FROM doc.lead_id) AND (customer IS NOT NULL OR NOT crm_backend.contract_office(p)) AND NOT crm_backend.contract_customer_ok(p,customer,advisor)
   THEN RAISE EXCEPTION 'contract_forbidden'; END IF;
  IF advisor IS NOT NULL AND NOT EXISTS(SELECT FROM public.app_users u JOIN public.crm_identities i ON i.app_user_id=u.id AND i.active
   WHERE u.id=advisor AND u.company_name=p->>'company_name' AND (u.department='Satış' OR u.departments ? 'Satış' OR u.role='ADMIN')) THEN RAISE EXCEPTION 'contract_invalid'; END IF;
  IF fmt IN ('pdf','docx') THEN
   IF p_file IS NULL AND doc.format=fmt THEN bytes:=doc.attachment; ELSE bytes:=decode(p_file,'base64'); END IF;
   IF bytes IS NULL OR octet_length(bytes)>8388608 OR
   (fmt='pdf' AND substring(bytes from 1 for 5)<>decode('255044462d','hex')) OR
   (fmt='docx' AND substring(bytes from 1 for 4)<>decode('504b0304','hex')) THEN RAISE EXCEPTION 'contract_invalid'; END IF;
  END IF;
  meta:=jsonb_build_object('name',p_doc->>'name','title',coalesce(nullif(p_doc->>'title',''),'Satış sözleşmesi'),'status',p_doc->>'status',
      'phone',coalesce(fields->>'phone',''),'property',coalesce(fields->>'project',''),'visitorId',coalesce(fields->>'visitorId',''));
  IF existing THEN UPDATE crm_backend.office_records SET payload=meta,revision=rev,updated_at=now() WHERE id=p_id;
  ELSE INSERT INTO crm_backend.office_records(id,company_name,kind,payload,revision,created_by)
    VALUES(p_id,p->>'company_name','contracts',meta,rev,auth.uid()); END IF;
  INSERT INTO crm_backend.contract_documents(record_id,lead_id,advisor_id,format,fields,attachment) VALUES(p_id,customer,advisor,fmt,fields,bytes)
  ON CONFLICT(record_id) DO UPDATE SET lead_id=excluded.lead_id,advisor_id=excluded.advisor_id,format=excluded.format,fields=excluded.fields,attachment=excluded.attachment;
 END IF;
 INSERT INTO crm_backend.contract_operations VALUES(auth.uid(),p_request,sig,p_id,rev);
 RETURN jsonb_build_object('id',p_id,'revision',rev);
END $$;
REVOKE ALL ON FUNCTION crm_backend.contract_office(jsonb),crm_backend.contract_sales(jsonb),crm_backend.contract_assignee(public.leads),
 crm_backend.contract_reader(jsonb,text,text),crm_backend.contract_customer_ok(jsonb,text,text),public.crm_contract_customers(text),public.crm_contract_list(text,uuid),
 public.crm_contract_open(uuid),public.crm_contract_write(uuid,uuid,bigint,jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_contract_customers(text),public.crm_contract_list(text,uuid),
 public.crm_contract_open(uuid),public.crm_contract_write(uuid,uuid,bigint,jsonb,text,boolean) TO authenticated;

-- Yeni veri/kimlik üretmez; gerçek Meta başvurusunun seçimini ve mevcut atıf bilgisini korur.
BEGIN;
ALTER TABLE public.meta_lead_events ADD COLUMN IF NOT EXISTS source_context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.meta_outbox ADD COLUMN IF NOT EXISTS meta_leadgen_id text;
-- Var olan olayın kimliği/payload'ı değişmez; yalnızca zaten kayıtlı orijinal lead ID indekslenir.
UPDATE public.meta_outbox SET meta_leadgen_id=snapshot->>'meta_lead_id' WHERE meta_leadgen_id IS NULL;
ALTER TABLE public.meta_outbox DROP CONSTRAINT IF EXISTS meta_outbox_lead_id_revision_event_name_test_mode_key;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.meta_outbox'::regclass AND conname='meta_outbox_source_event_key') THEN
    ALTER TABLE public.meta_outbox ADD CONSTRAINT meta_outbox_source_event_key UNIQUE(lead_id,revision,event_name,test_mode,meta_leadgen_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.meta_ingest_lead(p jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lid text; n text; candidates integer; inquiry jsonb; match_state text; context jsonb; attrs jsonb;
BEGIN
  IF coalesce(p->>'leadgenId','') !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'invalid_lead_id'; END IF;
  context:=jsonb_strip_nulls(jsonb_build_object(
    'formId',p->>'formId','formName',nullif(p->>'formName','Bilinmeyen Meta formu'),
    'pageId',p->>'pageId','adId',p->>'adId','adName',p->>'adName','adsetId',p->>'adsetId','adsetName',p->>'adsetName',
    'campaignId',p->>'campaignId','campaignName',p->>'campaignName','platform',p->>'platform','isOrganic',p->'isOrganic',
    'fullName',nullif(p->>'fullName','İsmi belirtilmemiş başvuru'),'firstName',p->>'firstName','lastName',p->>'lastName',
    'phone',nullif(p->>'phone',''),'email',nullif(p->>'email',''),'city',p->>'city','state',p->>'state',
    'zip',p->>'zip','country',p->>'country','warnings',coalesce(p->'warnings','[]'::jsonb)));
  attrs:=jsonb_strip_nulls(jsonb_build_object('metaFormId',p->>'formId','formName',nullif(p->>'formName','Bilinmeyen Meta formu'),
    'metaPageId',p->>'pageId','metaAdId',p->>'adId','metaAdName',p->>'adName','metaAdsetId',p->>'adsetId','metaAdsetName',p->>'adsetName',
    'metaCampaignId',p->>'campaignId','campaignName',p->>'campaignName','metaPlatform',p->>'platform','metaIsOrganic',p->'isOrganic','metaWarnings',coalesce(p->'warnings','[]'::jsonb)));
  PERFORM pg_advisory_xact_lock(hashtextextended('meta-event:'||(p->>'leadgenId'),0));
  SELECT lead_id INTO lid FROM meta_lead_events WHERE leadgen_id=p->>'leadgenId';
  IF FOUND THEN
    UPDATE meta_lead_events SET source_context=source_context||context WHERE leadgen_id=p->>'leadgenId';
    UPDATE leads SET inquiries=(SELECT coalesce(jsonb_agg(CASE WHEN i->>'metaLeadgenId'=p->>'leadgenId' THEN i||attrs ELSE i END ORDER BY ord),'[]')
      FROM jsonb_array_elements(coalesce(inquiries,'[]')) WITH ORDINALITY AS x(i,ord)) WHERE id=lid;
    RETURN lid;
  END IF;
  n:=meta_normalize_phone(p->>'phone');
  IF n IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('meta-phone:'||n,0));
    SELECT count(*),min(id) INTO candidates,lid FROM leads WHERE meta_normalize_phone(phone)=n;
    IF candidates <> 1 THEN lid:=NULL; END IF;
  ELSE candidates:=0; END IF;
  match_state:=CASE WHEN n IS NULL THEN 'missing_phone' WHEN candidates>1 THEN 'ambiguous' WHEN candidates=1 THEN 'matched' ELSE 'new' END;
  inquiry:=jsonb_strip_nulls(jsonb_build_object(
    'id','meta-inq-'||(p->>'leadgenId'),'metaLeadgenId',p->>'leadgenId',
    'metaFormId',p->>'formId','metaAdId',p->>'adId','metaCampaignId',p->>'campaignId',
    'formName',p->>'formName','campaignName',p->>'campaignName','source','META_ADS',
    'channel','Meta Lead Ads','createdAt',p->>'createdAt','metaAnswers',p->'answers',
    'preferredHousingType',p->>'housingType','budget',p->'budget'))||attrs;
  IF lid IS NULL THEN
    lid:='lead-meta-'||(p->>'leadgenId');
    INSERT INTO leads(id,full_name,phone,whatsapp_phone,email,source,form_name,channel,stage,owner,tags,
      inquiries,meta_answers,meta_lead_id,preferred_housing_type,budget,created_at,updated_at)
    VALUES(lid,p->>'fullName',coalesce(n,''),coalesce(n,''),p->>'email','META_ADS',p->>'formName','Meta Lead Ads','NEW','Atanmamış','["Meta Reklam"]',
      jsonb_build_array(inquiry),p->'answers',p->>'leadgenId',p->>'housingType',(p->>'budget')::numeric,(p->>'createdAt')::timestamptz,now());
  ELSE
    PERFORM 1 FROM leads WHERE id=lid FOR UPDATE;
    -- Eski CSV inquiry'si ancak Graph'tan doğrulanan tam telefonla eşleşen aynı müşteride tekrar sayılmaz.
    UPDATE leads SET inquiries=CASE
      WHEN coalesce(inquiries,'[]'::jsonb) @> jsonb_build_array(jsonb_build_object('metaLeadgenId',p->>'leadgenId'))
      THEN inquiries ELSE jsonb_build_array(inquiry)||coalesce(inquiries,'[]'::jsonb) END,
      updated_at=now() WHERE id=lid;
  END IF;
  INSERT INTO meta_lead_events(leadgen_id,lead_id,form_id,ad_id,campaign_id,submitted_at,raw_fields,matching_state,source_context)
    VALUES(p->>'leadgenId',lid,p->>'formId',p->>'adId',p->>'campaignId',(p->>'createdAt')::timestamptz,p->'fields',match_state,context);
  INSERT INTO lead_activities(id,lead_id,type,content,author)
    VALUES('meta-act-'||(p->>'leadgenId'),lid,'NOTE','Meta form başvurusu kaydedildi.','Meta Webhook');
  RETURN lid;
END $$;


CREATE OR REPLACE FUNCTION public.meta_enqueue(p_user uuid,p_lead text,p_test boolean,p_leadgen_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l leads; settings meta_settings; eid uuid; ename text; verified_id text; source jsonb; source_count integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND (can_send OR is_admin)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO settings FROM meta_settings WHERE id=true;
  IF NOT settings.security_ready OR (NOT p_test AND NOT settings.enabled) THEN RAISE EXCEPTION 'integration_disabled'; END IF;
  IF p_test AND NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND is_admin) THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO l FROM leads WHERE id=p_lead FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF NOT meta_can_read_lead(p_user,p_lead) THEN RAISE EXCEPTION 'lead_forbidden'; END IF;
  IF NOT p_test AND (l.meta_revision=0 OR l.meta_changed_at < settings.enabled_at) THEN RAISE EXCEPTION 'historical_backfill_disabled'; END IF;
  IF l.meta_changed_at IS NULL THEN RAISE EXCEPTION 'stage_change_required'; END IF;
  ename:=meta_event_for_stage(l.stage);
  IF ename IS NULL OR (ename='QualifiedLead' AND NOT l.is_qualified) THEN RAISE EXCEPTION 'ineligible_stage'; END IF;
  IF p_leadgen_id IS NULL THEN
    SELECT count(*) INTO source_count FROM meta_lead_events WHERE lead_id=l.id;
    IF source_count>1 THEN RAISE EXCEPTION 'meta_source_selection_required'; END IF;
  END IF;
  SELECT leadgen_id,source_context||jsonb_strip_nulls(jsonb_build_object('formId',form_id,'adId',ad_id,'campaignId',campaign_id))
    INTO verified_id,source FROM meta_lead_events WHERE lead_id=l.id AND (p_leadgen_id IS NULL OR leadgen_id=p_leadgen_id);
  IF verified_id IS NULL THEN RAISE EXCEPTION 'verified_meta_source_required'; END IF;
  -- Kuyruk kaydı iş kararıyla atomiktir. Teslim hız sınırı müşterinin aşama kaydını geri alamaz.
  INSERT INTO meta_outbox(lead_id,revision,event_name,test_mode,requested_by,occurred_at,meta_leadgen_id,snapshot)
    VALUES(l.id,l.meta_revision,ename,p_test,p_user,l.meta_changed_at,verified_id,
      jsonb_build_object('id',l.id,'stage',l.stage,'is_qualified',l.is_qualified,'phone',l.phone,
        'email',l.email,'full_name',l.full_name,'meta_lead_id',verified_id,'meta_source',source))
    ON CONFLICT(lead_id,revision,event_name,test_mode,meta_leadgen_id) DO NOTHING RETURNING id INTO eid;
  IF eid IS NULL THEN SELECT id INTO eid FROM meta_outbox WHERE lead_id=l.id AND revision=l.meta_revision AND event_name=ename AND test_mode=p_test AND meta_leadgen_id=verified_id; END IF;
  RETURN eid;
END $$;


CREATE OR REPLACE FUNCTION public.meta_enqueue(p_user uuid,p_lead text,p_test boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN meta_enqueue(p_user,p_lead,p_test,NULL); END $$;

CREATE OR REPLACE FUNCTION public.meta_enqueue_checked(p_user uuid,p_lead text,p_test boolean,p_revision bigint,p_event text,p_leadgen_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l leads;
BEGIN
  SELECT * INTO l FROM leads WHERE id=p_lead FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR p_event IS NULL OR l.meta_revision<>p_revision
    OR meta_event_for_stage(l.stage) IS DISTINCT FROM p_event THEN RAISE EXCEPTION 'stale_stage'; END IF;
  RETURN meta_enqueue(p_user,p_lead,p_test,p_leadgen_id);
END $$;

CREATE OR REPLACE FUNCTION public.meta_list_sources(p_user uuid,p_lead text) RETURNS TABLE(leadgen_id text,submitted_at timestamptz,context jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM meta_members WHERE auth_user_id=p_user AND (can_send OR is_admin)) OR NOT meta_can_read_lead(p_user,p_lead) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT e.leadgen_id,e.submitted_at,(e.source_context-'fullName'-'firstName'-'lastName'-'email'-'phone'-'city'-'state'-'zip'-'country')
    ||jsonb_strip_nulls(jsonb_build_object('formId',e.form_id,'adId',e.ad_id,'campaignId',e.campaign_id))
    FROM meta_lead_events e WHERE e.lead_id=p_lead ORDER BY e.submitted_at DESC,e.leadgen_id;
END $$;
REVOKE ALL ON FUNCTION public.meta_enqueue(uuid,text,boolean,text),public.meta_enqueue_checked(uuid,text,boolean,bigint,text,text),public.meta_list_sources(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_enqueue(uuid,text,boolean,text),public.meta_enqueue_checked(uuid,text,boolean,bigint,text,text),public.meta_list_sources(uuid,text) TO service_role;
COMMIT;

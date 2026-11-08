BEGIN;

CREATE OR REPLACE FUNCTION crm_backend.validate_business_record()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  body jsonb := NEW.payload;
  day text;
  previous jsonb;
  amount numeric;
BEGIN
  IF TG_OP='UPDATE' AND NEW.deleted AND NEW.module IN ('collections','payments')
     AND OLD.payload->>'status' IN ('COLLECTED','PAID','REFUNDED')
  THEN RAISE EXCEPTION 'crm_financial_record_locked' USING ERRCODE='42501'; END IF;
  IF NEW.deleted OR NEW.module NOT IN ('requests','collections','payments') THEN RETURN NEW; END IF;
  IF octet_length(body::text)>65536 THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  IF TG_OP='UPDATE' THEN previous:=OLD.payload; END IF;

  IF NEW.module='requests' THEN
    IF length(btrim(coalesce(body->>'customerName',''))) NOT BETWEEN 1 AND 250
       OR length(btrim(coalesce(body->>'subject',''))) NOT BETWEEN 1 AND 500
       OR coalesce(body->>'priority','') NOT IN ('Düşük','Orta','Yüksek','Acil')
       OR coalesce(body->>'status','') NOT IN ('Açık','İşlemde','Çözüldü','İptal')
       OR coalesce(body->>'category','') NOT IN ('Satış Öncesi Bilgi','Proje & Kat Planı','Ödeme & Finansman','Satış Sonrası Destek','Genel Talep')
    THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
  ELSE
    IF jsonb_typeof(body->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
    amount:=(body->>'amount')::numeric;
    IF amount<=0 OR amount>999999999999.99 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
    day:=body->>'dueDate';
    IF coalesce(day,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
    BEGIN
      PERFORM day::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'crm_invalid_input';
    END;
    IF previous->>'status' IN ('COLLECTED','PAID','REFUNDED') AND (
       previous->'amount' IS DISTINCT FROM body->'amount'
       OR previous->>'status' IS DISTINCT FROM body->>'status' AND NOT (
         NEW.module='collections' AND previous->>'status'='COLLECTED' AND body->>'status'='REFUNDED'
       )) THEN RAISE EXCEPTION 'crm_financial_record_locked' USING ERRCODE='42501'; END IF;

    IF NEW.module='collections' THEN
      IF length(btrim(coalesce(body->>'customerName',''))) NOT BETWEEN 1 AND 250
         OR coalesce(body->>'type','') NOT IN ('DEPOSIT','DOWN_PAYMENT','INSTALLMENT','FULL_PAYMENT')
         OR coalesce(body->>'status','') NOT IN ('PENDING','OVERDUE','COLLECTED','REFUNDED')
      THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
      IF body->>'status'='REFUNDED' THEN
        -- Upsert INSERT tetikleyicisinde mevcut satır henüz OLD olarak görünmez.
        IF TG_OP='INSERT' THEN
          SELECT payload INTO previous FROM crm_backend.records WHERE module=NEW.module AND id=NEW.id;
        END IF;
        IF body->>'type'<>'DEPOSIT' OR coalesce(previous->>'status','') NOT IN ('COLLECTED','REFUNDED')
           OR length(btrim(coalesce(body->>'refundReason',''))) NOT BETWEEN 3 AND 2000
        THEN RAISE EXCEPTION 'crm_invalid_refund' USING ERRCODE='42501'; END IF;
        body:=body || jsonb_build_object('refundedByUserName',public.crm_get_my_profile()->>'full_name');
      END IF;
    ELSE
      IF length(btrim(coalesce(body->>'title',''))) NOT BETWEEN 1 AND 500
         OR length(btrim(coalesce(body->>'payee',''))) NOT BETWEEN 1 AND 250
         OR coalesce(body->>'category','') NOT IN ('COMMISSION','CONSTRUCTION','MARKETING','OFFICE','TAX')
         OR coalesce(body->>'status','') NOT IN ('PENDING','OVERDUE','PAID')
      THEN RAISE EXCEPTION 'crm_invalid_input'; END IF;
    END IF;
    IF body->>'status' IN ('COLLECTED','PAID') THEN
      body:=body || jsonb_build_object('paidDate',coalesce(previous->>'paidDate',to_char(current_date,'YYYY-MM-DD')));
    END IF;
  END IF;
  NEW.payload:=body || jsonb_build_object('createdAt',NEW.created_at,'updatedAt',NEW.updated_at);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.validate_business_record() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crm_validate_business_record ON crm_backend.records;
CREATE TRIGGER crm_validate_business_record BEFORE INSERT OR UPDATE ON crm_backend.records
FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_business_record();
COMMIT;

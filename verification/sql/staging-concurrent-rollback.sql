-- YALNIZCA AYRI STAGING. İki bağımsız bağlantıda çalıştırılır.
-- Mevcut tek test başvurusunun tekrar işlenmesini sınar; tüm yazımlar geri alınır.
BEGIN;
DO $$
DECLARE p jsonb; expected_id text; actual_id text;
BEGIN
 IF (SELECT count(*) FROM public.meta_lead_events)<>1 THEN RAISE EXCEPTION 'Bu test yalnızca tek başvurulu staging için hazırlanmıştır.'; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_settings WHERE enabled OR auto_sync) THEN RAISE EXCEPTION 'Canlı veya otomatik gönderim açık: test durduruldu.'; END IF;
 SELECT source_context||jsonb_build_object('leadgenId',leadgen_id,'createdAt',submitted_at,'fields',raw_fields),lead_id
 INTO p,expected_id FROM public.meta_lead_events;
 actual_id:=public.meta_ingest_lead(p);
 IF actual_id IS DISTINCT FROM expected_id THEN RAISE EXCEPTION 'Tekrar işleme farklı müşteriye bağlandı.'; END IF;
 PERFORM pg_sleep(3);
END $$;
ROLLBACK;
SELECT pg_backend_pid() AS backend_pid,true AS duplicate_returned_original_customer,true AS transaction_rolled_back;

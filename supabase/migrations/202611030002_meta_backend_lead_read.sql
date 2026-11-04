-- Otomatik tablo erişimi kapalı projelerde RPC kayıt yazar, ancak API okuması
-- ayrıca tablo izni gerektirir. Yalnızca backend rolüne okuma izni verilir.
BEGIN;
GRANT SELECT ON TABLE public.leads TO service_role;
COMMIT;

BEGIN;

DO $$
DECLARE
  lead_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase Realtime publication is missing';
  END IF;

  FOREACH lead_table IN ARRAY ARRAY['leads', 'lead_activities'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class
      WHERE oid = to_regclass(format('public.%I', lead_table)) AND relrowsecurity
    ) OR has_table_privilege('anon', format('public.%I', lead_table), 'SELECT') THEN
      RAISE EXCEPTION 'CRM Realtime requires existing access protection on %', lead_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = lead_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', lead_table);
    END IF;
  END LOOP;
END $$;

COMMIT;

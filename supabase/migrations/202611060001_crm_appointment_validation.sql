BEGIN;

CREATE OR REPLACE FUNCTION crm_backend.validate_appointment()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  appointment_date text := NEW.payload->>'date';
BEGIN
  IF NEW.module <> 'appointments' OR NEW.deleted THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.payload->'customerName') IS DISTINCT FROM 'string'
     OR length(btrim(NEW.payload->>'customerName')) NOT BETWEEN 1 AND 250
     OR coalesce(appointment_date, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR coalesce(NEW.payload->>'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR coalesce(NEW.payload->>'type', '') NOT IN ('ONLINE', 'OFFICE', 'ON_SITE')
     OR coalesce(NEW.payload->>'status', '') NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
     OR octet_length(NEW.payload::text) > 32768
  THEN
    RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023';
  END IF;

  BEGIN
    PERFORM appointment_date::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'crm_invalid_input' USING ERRCODE='22023';
  END;

  NEW.payload := NEW.payload || jsonb_build_object(
    'createdByUserId', NEW.owner_id,
    'createdByDepartment', NEW.department,
    'createdAt', NEW.created_at
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_backend.validate_appointment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crm_validate_appointment ON crm_backend.records;
CREATE TRIGGER crm_validate_appointment
BEFORE INSERT OR UPDATE ON crm_backend.records
FOR EACH ROW EXECUTE FUNCTION crm_backend.validate_appointment();

COMMIT;

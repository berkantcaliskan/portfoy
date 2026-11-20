BEGIN;

LOCK TABLE crm_backend.office_records IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS crm_backend.office_contract_counters (
  company_name text NOT NULL,
  contract_year integer NOT NULL,
  last_number integer NOT NULL CHECK (last_number BETWEEN 1 AND 999999),
  PRIMARY KEY (company_name, contract_year)
);
ALTER TABLE crm_backend.office_contract_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_backend.office_contract_counters FROM PUBLIC, anon, authenticated;

-- A repeatable install never lowers an existing counter.
INSERT INTO crm_backend.office_contract_counters AS counters (company_name, contract_year, last_number)
SELECT company_name,
       substring(payload->>'contractNumber' FROM 3 FOR 4)::integer,
       max(right(payload->>'contractNumber', 6)::integer)
FROM crm_backend.office_records
WHERE kind = 'contracts'
  AND payload->>'contractNumber' ~ '^S/[0-9]{10}$'
  AND right(payload->>'contractNumber', 6) <> '000000'
GROUP BY company_name, substring(payload->>'contractNumber' FROM 3 FOR 4)::integer
ON CONFLICT (company_name, contract_year) DO UPDATE
SET last_number = greatest(counters.last_number, excluded.last_number);

CREATE UNIQUE INDEX IF NOT EXISTS office_records_company_contract_number
ON crm_backend.office_records (company_name, (payload->>'contractNumber'))
WHERE kind = 'contracts' AND payload ? 'contractNumber';

CREATE OR REPLACE FUNCTION crm_backend.assign_office_contract_number()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  number_text text;
  number_year integer;
  next_number integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    number_text := nullif(OLD.payload->>'contractNumber', '');
  END IF;

  IF number_text IS NULL THEN
    number_year := extract(year FROM NEW.created_at AT TIME ZONE 'Europe/Istanbul')::integer;
    -- The counter row serializes concurrent saves for the same company and year.
    INSERT INTO crm_backend.office_contract_counters AS counters (company_name, contract_year, last_number)
    VALUES (NEW.company_name, number_year, 1)
    ON CONFLICT (company_name, contract_year) DO UPDATE
    SET last_number = counters.last_number + 1
    WHERE counters.last_number < 999999
    RETURNING last_number INTO next_number;

    IF next_number IS NULL THEN
      RAISE EXCEPTION 'office_contract_number_exhausted';
    END IF;
    number_text := 'S/' || number_year::text || lpad(next_number::text, 6, '0');
  END IF;

  NEW.payload := jsonb_set(NEW.payload, '{contractNumber}', to_jsonb(number_text));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_backend.assign_office_contract_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS office_contract_number_on_save ON crm_backend.office_records;
CREATE TRIGGER office_contract_number_on_save
BEFORE INSERT OR UPDATE ON crm_backend.office_records
FOR EACH ROW WHEN (NEW.kind = 'contracts')
EXECUTE FUNCTION crm_backend.assign_office_contract_number();

COMMIT;

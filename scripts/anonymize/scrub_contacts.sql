-- Free text keeps its shape with each personal address or number swapped for
-- a stand-in. Organization and government addresses are published contacts
-- and stay.
CREATE FUNCTION pg_temp.scrub_contacts(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        t,
        '[A-Za-z0-9._%+-]+@(?!(?:[A-Za-z0-9-]+\.)*(?:worldalliance\.org|thealliance\.org|example\.com|example\.org|[A-Za-z0-9-]+\.gov)(?![A-Za-z0-9.-]*[A-Za-z0-9]))[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}',
        'redacted@example.com',
        'g'
      ),
      '\+(?!1555)[1-9](?:[ .()-]{0,2}[0-9]){7,14}(?![0-9])',
      '+15550000000',
      'g'
    ),
    -- Separators are required so bare IDs, such as cid= campaign IDs, stay.
    '(?<![0-9A-Za-z+])(?:1[ .-])?(?:\([2-9][0-9]{2}\)|[2-9][0-9]{2})[ .-]{0,2}[2-9][0-9]{2}[ .-][0-9]{4}(?![0-9A-Za-z])',
    '+15550000000',
    'g'
  )
$fn$;

-- A form answer that is only a number is a phone number even without
-- separators.
CREATE FUNCTION pg_temp.scrub_answer(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT pg_temp.scrub_contacts(regexp_replace(
    t,
    '^\s*(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\)|[2-9][0-9]{2})[ .-]?[2-9][0-9]{2}[ .-]?[0-9]{4}\s*$',
    '+15550000000'
  ))
$fn$;

-- Scrubs each string value rather than the serialized document, where an
-- escape such as \n would sit against a number or address and hide it.
CREATE FUNCTION pg_temp.scrub_contacts_jsonb(j JSONB, answers BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $fn$
BEGIN
  CASE jsonb_typeof(j)
    WHEN 'string' THEN
      IF answers THEN
        RETURN to_jsonb(pg_temp.scrub_answer(j #>> '{}'));
      END IF;
      RETURN to_jsonb(pg_temp.scrub_contacts(j #>> '{}'));
    WHEN 'object' THEN
      RETURN COALESCE(
        (SELECT jsonb_object_agg(k, pg_temp.scrub_contacts_jsonb(v, answers))
         FROM jsonb_each(j) AS e(k, v)),
        '{}'::jsonb
      );
    WHEN 'array' THEN
      RETURN COALESCE(
        (SELECT jsonb_agg(pg_temp.scrub_contacts_jsonb(v, answers) ORDER BY i)
         FROM jsonb_array_elements(j) WITH ORDINALITY AS e(v, i)),
        '[]'::jsonb
      );
    ELSE
      RETURN j;
  END CASE;
END
$fn$;

-- For a jsonb string holding serialized JSON, where escapes would sit against a
-- contact. It is rewritten only when a contact changed, so the rest keeps its
-- original formatting.
CREATE FUNCTION pg_temp.scrub_contacts_json_string(j JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  parsed JSONB;
  scrubbed JSONB;
BEGIN
  IF jsonb_typeof(j) IS DISTINCT FROM 'string' THEN
    RETURN pg_temp.scrub_contacts_jsonb(j, answers => false);
  END IF;
  parsed := (j #>> '{}')::jsonb;
  scrubbed := pg_temp.scrub_contacts_jsonb(parsed, answers => false);
  IF scrubbed = parsed THEN
    RETURN j;
  END IF;
  RETURN to_jsonb(scrubbed::text);
END
$fn$;

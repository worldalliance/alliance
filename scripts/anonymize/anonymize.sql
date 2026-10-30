-- ============================================================================
-- Anonymize members.
--
-- Order matters. `mms` is rewritten first, while `user."phoneNumber"` still
-- holds the original values it joins on.
-- ============================================================================

UPDATE "mms" m
SET "to" = '+1555' || lpad(u.id::text, 7, '0')
FROM "user" u
WHERE m."to" = u."phoneNumber";

UPDATE "mms" m
SET "from" = '+1555' || lpad(u.id::text, 7, '0')
FROM "user" u
WHERE m."from" = u."phoneNumber";

-- Our own Twilio number, and any row whose member no longer exists.
UPDATE "mms" SET "to"   = '+15550000000' WHERE "to"   NOT LIKE '+1555%';
UPDATE "mms" SET "from" = '+15550000000' WHERE "from" NOT LIKE '+1555%';

-- Opt-out records keep both the number and the text the member replied with.
UPDATE "mms_optout" o
SET "phoneNumber" = '+1555' || lpad(u.id::text, 7, '0')
FROM "user" u
WHERE o."userId" = u.id;

UPDATE "mms_optout"
SET "phoneNumber" = '+15550000000'
WHERE "phoneNumber" NOT LIKE '+1555%';

-- `phoneNumber` is nullable; keep the NULLs so staging still exercises the
-- "member has no phone number" branches.
UPDATE "user"
SET "phoneNumber" = CASE
                      WHEN "phoneNumber" IS NULL THEN NULL
                      ELSE '+1555' || lpad(id::text, 7, '0')
                    END;

-- App-store review accounts keep prod's email and password, so the credentials
-- the stores hold sign in here after every sync. A snapshot from before prod
-- gained the column has none.
CREATE TEMP TABLE review_account (id INT PRIMARY KEY) ON COMMIT DROP;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user'
      AND column_name = 'isTestUser'
  ) THEN
    INSERT INTO review_account SELECT id FROM "user" WHERE "isTestUser";
  END IF;
END $$;

-- MailService sends nothing to @example.com, so every stand-in address stays
-- on that domain.
UPDATE "user"
SET
  "email"    = 'user'||id||'@example.com',
  "password" = :'password_hash'
WHERE id NOT IN (SELECT id FROM review_account);

-- Prod gains this column, and with it any phone entries, only once the
-- migration adding it ships there; until then the guard skips the rewrite.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'waitlist_entry'
      AND column_name = 'phoneNumber'
  ) THEN
    UPDATE "waitlist_entry"
    SET "phoneNumber" = '+1555' || lpad(id::text, 7, '0')
    WHERE "phoneNumber" IS NOT NULL;
  END IF;
END $$;

-- Pending codes name the contact they went to, and staging has no use for
-- prod's. Prod gains the table only once the migration adding it ships there.
DO $$
BEGIN
  IF to_regclass('otp_challenge') IS NOT NULL THEN
    TRUNCATE "otp_challenge";
  END IF;
END $$;

-- Kora participants are not members and get no anonymized stand-ins; staging
-- signs up its own. CASCADE also empties, in full, every table with a foreign
-- key into these.
DO $$
BEGIN
  IF to_regclass('kora_participant') IS NOT NULL THEN
    TRUNCATE "kora_participant", "kora_participant_session",
      "kora_participant_signup" CASCADE;
  END IF;
END $$;

UPDATE "waitlist_entry"
SET "email" = 'waitlist'||id||'@example.com'
WHERE "email" IS NOT NULL;

TRUNCATE "waitlist_mail_allowance";

UPDATE "oauth_account" SET "email" = 'oauth'||id||'@example.com';

UPDATE "action_partnership_response"
SET "contact" = 'partner'||id||'@example.com';

-- No code reads these legacy contact tables any more.
TRUNCATE "prefill_user", "onetime_invite_request";

\ir scrub_contacts.sql

DO $$
DECLARE
  c RECORD;
  n BIGINT;
  scrubbed TEXT;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('event_log', 'message', 'text'),
      ('event_log', 'blob', 'jsonb'),
      ('form_response', 'answers', 'answers'),
      ('form_response_draft', 'answers', 'answers'),
      ('message', 'body', 'text'),
      ('notification', 'message', 'text'),
      ('notification', 'targetContent', 'text'),
      ('notification', 'content', 'jsonb'),
      ('unread_content', 'content', 'jsonb'),
      ('push', 'body', 'text'),
      ('ai_detection_result', 'rawApiResponse', 'json_string'),
      ('user', 'profileDescription', 'text'),
      ('mail', 'renderedHtml', 'text'),
      ('onetime_invite', 'invitee', 'text'),
      ('onetime_invite', 'info', 'text'),
      ('waitlist_entry', 'reason', 'text'),
      ('waitlist_entry', 'nonprofitNominations', 'text'),
      ('mms_optout', 'rawBody', 'text'),
      ('ambassador_program_interaction', 'text', 'text'),
      ('user_away_range', 'note', 'text'),
      ('action_activity_comment', 'content', 'text'),
      ('action_partnership_response', 'notes', 'text'),
      ('action_partnership_response', 'desiredCollaboration', 'text'),
      ('action_partnership_response', 'outreachOtherDetails', 'text'),
      ('action_partnership_note', 'body', 'text')
    ) AS v(tbl, col, kind)
  LOOP
    scrubbed := format(
      CASE c.kind
        WHEN 'text' THEN 'pg_temp.scrub_contacts(%1$I::text)'
        WHEN 'jsonb' THEN 'pg_temp.scrub_contacts_jsonb(%1$I, answers => false)'
        WHEN 'answers' THEN 'pg_temp.scrub_contacts_jsonb(%1$I, answers => true)'
        WHEN 'json_string' THEN 'pg_temp.scrub_contacts_json_string(%1$I)'
      END,
      c.col
    );
    EXECUTE format(
      'UPDATE %1$I SET %2$I = %3$s WHERE %2$I IS DISTINCT FROM %3$s',
      c.tbl, c.col, scrubbed
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'Scrubbed contacts in % %.% row(s).', n, c.tbl, c.col;
  END LOOP;
END $$;

-- Keys the fake names and sentences, so each comes out the same from one sync
-- to the next. Change it to deal new ones.
\set seed 1
SELECT set_config('anonymize.seed', :'seed', true);

CREATE TEMP TABLE first_name (id SERIAL PRIMARY KEY, name TEXT NOT NULL)
  ON COMMIT DROP;
CREATE TEMP TABLE last_name (id SERIAL PRIMARY KEY, name TEXT NOT NULL)
  ON COMMIT DROP;
\copy first_name (name) FROM '/home/ec2-user/nest-backend/scripts/anonymize/first_names.txt' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')
\copy last_name (name) FROM '/home/ec2-user/nest-backend/scripts/anonymize/last_names.txt' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

UPDATE "user" u
SET "name" = f.name || ' ' || l.name
FROM first_name f, last_name l,
     (SELECT count(*) FROM first_name) fc(n),
     (SELECT count(*) FROM last_name) lc(n)
WHERE f.id = 1 + (hashtext(:'seed' || ':first:' || u.id) & 2147483647) % fc.n
  AND l.id = 1 + (hashtext(:'seed' || ':last:' || u.id) & 2147483647) % lc.n;

-- One `<word count>\t<sentence>` per line.
CREATE TEMP TABLE dracula_sentence (
  id    SERIAL PRIMARY KEY,
  words INT NOT NULL CHECK (words > 0),
  body  TEXT NOT NULL
) ON COMMIT DROP;
\copy dracula_sentence (words, body) FROM '/home/ec2-user/nest-backend/scripts/anonymize/dracula_words.txt' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')
CREATE INDEX ON dracula_sentence (words);

-- Sentences totalling the answer's word count, chained when no single sentence
-- is that long, and picked by hashing the seed with `answer_key` rather than
-- the answer, so equal answers don't get equal sentences. NULL stays NULL and
-- blank stays blank.
CREATE FUNCTION pg_temp.dracula(answer JSONB, answer_key TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $fn$
DECLARE
  remaining   INT;
  bucket      INT;
  bucket_size INT;
  chunk       INT := 0;
  sentence    dracula_sentence;
  sentences   TEXT[] := '{}';
BEGIN
  IF jsonb_typeof(answer) = 'null' THEN
    RETURN answer;
  END IF;

  SELECT count(*) INTO remaining
  FROM regexp_matches(answer #>> '{}', '\S+', 'g');

  WHILE remaining > 0 LOOP
    SELECT max(words) INTO bucket FROM dracula_sentence WHERE words <= remaining;

    IF bucket IS NULL THEN
      RAISE EXCEPTION 'dracula_words.txt has no sentence of % words or fewer',
        remaining;
    END IF;

    SELECT count(*) INTO bucket_size FROM dracula_sentence WHERE words = bucket;

    SELECT * INTO sentence
    FROM dracula_sentence
    WHERE words = bucket
    ORDER BY id
    OFFSET (
      hashtext(
        current_setting('anonymize.seed') || ':' || answer_key || ':' || chunk
      ) & 2147483647
    ) % bucket_size
    LIMIT 1;

    sentences := sentences || sentence.body;
    remaining := remaining - sentence.words;
    chunk := chunk + 1;
  END LOOP;

  RETURN to_jsonb(array_to_string(sentences, ' '));
END
$fn$;

-- ============================================================================
-- Selectively redact text-based answers in form_response instead of wiping all
-- answers. Preserves non-text values (numbers, booleans, radio/select choices,
-- dates, cities, etc.) so staging data remains structurally useful.
--
-- Text-like field kinds that get redacted: text, textarea, email, phone
-- List fields are walked recursively to redact nested text sub-fields.
-- ============================================================================
DO $$
DECLARE
  resp        RECORD;
  page        JSONB;
  field       JSONB;
  sub_field   JSONB;
  field_id    TEXT;
  field_kind  TEXT;
  new_answers JSONB;
  list_val    JSONB;
  item        JSONB;
  item_index  BIGINT;
  new_item    JSONB;
  new_list    JSONB;
  text_kinds  TEXT[] := ARRAY['text', 'textarea', 'email', 'phone'];
  updated_count INT := 0;
BEGIN
  FOR resp IN
    SELECT fr.id       AS resp_id,
           fr.answers  AS answers,
           fs.schema   AS form_schema
    FROM   form_response fr
    JOIN   form_snapshot fs ON fs.id = fr."formSnapshotId"
    WHERE  fr.answers IS NOT NULL
      AND  fr.answers != '{}'::jsonb
  LOOP
    new_answers := resp.answers;

    FOR page IN SELECT * FROM jsonb_array_elements(resp.form_schema -> 'pages')
    LOOP
      FOR field IN SELECT * FROM jsonb_array_elements(page -> 'fields')
      LOOP
        field_id   := field ->> 'id';
        field_kind := field ->> 'kind';

        CONTINUE WHEN NOT (new_answers ? field_id);

        IF field_kind = ANY(text_kinds) THEN
          new_answers := jsonb_set(
            new_answers,
            ARRAY[field_id],
            pg_temp.dracula(
              new_answers -> field_id,
              resp.resp_id || ':' || field_id
            )
          );

        ELSIF field_kind = 'list' THEN
          list_val := new_answers -> field_id;

          IF jsonb_typeof(list_val) = 'array' THEN
            new_list := '[]'::jsonb;

            FOR item, item_index IN
              SELECT * FROM jsonb_array_elements(list_val) WITH ORDINALITY
            LOOP
              new_item := item;

              FOR sub_field IN SELECT * FROM jsonb_array_elements(field -> 'fields')
              LOOP
                IF (sub_field ->> 'kind') = ANY(text_kinds)
                   AND new_item ? (sub_field ->> 'id')
                THEN
                  new_item := jsonb_set(
                    new_item,
                    ARRAY[sub_field ->> 'id'],
                    pg_temp.dracula(
                      new_item -> (sub_field ->> 'id'),
                      resp.resp_id || ':' || field_id || ':' || item_index
                        || ':' || (sub_field ->> 'id')
                    )
                  );
                END IF;
              END LOOP;

              new_list := new_list || jsonb_build_array(new_item);
            END LOOP;

            new_answers := jsonb_set(new_answers, ARRAY[field_id], new_list);
          END IF;
        END IF;
      END LOOP;
    END LOOP;

    IF new_answers IS DISTINCT FROM resp.answers THEN
      UPDATE form_response SET answers = new_answers WHERE id = resp.resp_id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Redacted text answers in % form response(s).', updated_count;
END $$;

UPDATE "mail" SET "to" = 'user'||id||'@example.com';

-- Clear push tokens so staging can never reach real devices
UPDATE "user_device" SET "expoPushToken" = NULL;
UPDATE "push" SET "expoPushToken" = 'pruned';

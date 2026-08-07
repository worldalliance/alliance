#!/usr/bin/env bash
#
# This script runs in the staging host via cronjob

set -euo pipefail

source /home/ec2-user/db-sync.env

PROD_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@${PROD_DB_HOST}:5432/${PROD_DB_NAME}"
STAGING_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/${STAGING_DB_NAME}"

STAGING_ADMIN_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/postgres"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/home/ec2-user/prod_dump_${TIMESTAMP}.pgcustom"

echo "[$(date)] ==> Starting prod → staging sync"
echo "[$(date)] ==> Dumping prod database to ${DUMP_FILE}..."

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  "$PROD_URL" \
  --file="$DUMP_FILE"

echo "[$(date)] ==> Terminating existing connections & recreating staging database..."

psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${STAGING_DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${STAGING_DB_NAME};
CREATE DATABASE ${STAGING_DB_NAME} WITH TEMPLATE=template0 ENCODING='UTF8';
SQL

echo "[$(date)] ==> Restoring dump into staging database..."

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$STAGING_URL" \
  "$DUMP_FILE"

psql "$STAGING_URL" -v ON_ERROR_STOP=1 <<'SQL'
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
SET
  "email"       = 'user'||id||'@example.com',
  "phoneNumber" = CASE
                    WHEN "phoneNumber" IS NULL THEN NULL
                    ELSE '+1555' || lpad(id::text, 7, '0')
                  END;
UPDATE "user" SET "password" = 'pw';

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
  new_item    JSONB;
  new_list    JSONB;
  text_kinds  TEXT[] := ARRAY['text', 'textarea', 'email', 'phone'];
  redacted    CONSTANT JSONB := '"answer"';
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
          new_answers := jsonb_set(new_answers, ARRAY[field_id], redacted);

        ELSIF field_kind = 'list' THEN
          list_val := new_answers -> field_id;

          IF jsonb_typeof(list_val) = 'array' THEN
            new_list := '[]'::jsonb;

            FOR item IN SELECT * FROM jsonb_array_elements(list_val)
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
                    redacted
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
UPDATE "user_device"
SET "expoPushToken" = NULL,
    "liveActivityPushToStartToken" = NULL;
UPDATE "live_activity_registration" SET "updateToken" = NULL;
UPDATE "push" SET "expoPushToken" = 'pruned';

SQL

echo "[$(date)] ==> S3 sync s3://$PROD_ASSETS_BUCKET -> s3://$STAGING_ASSETS_BUCKET"

aws s3 sync \
  "s3://${PROD_ASSETS_BUCKET}/" \
  "s3://${STAGING_ASSETS_BUCKET}/" \
  --only-show-errors \
  --size-only

SYNC_EXIT=$?
if [ $SYNC_EXIT -ne 0 ]; then
  echo "[$(date)] S3 sync failed with exit code $SYNC_EXIT"
  exit $SYNC_EXIT
fi

echo "[$(date)] ==> S3 sync complete."

if [ -f "$DUMP_FILE" ]; then
  rm -f "$DUMP_FILE"
  echo "[$(date)] ==> Removed temporary dump file: $DUMP_FILE"
fi

echo "[$(date)] ==> Sync completed successfully."

#!/usr/bin/env bash
#
# This script runs in the staging host via cronjob

set -euo pipefail

umask 077

source /home/ec2-user/db-sync.env

# Checked ahead of the traps below, and of every other variable, because a trap
# has no way to report its own failure without these two.
: "${SLACK_WEBHOOK_URL:?missing in db-sync.env}"

if ! command -v jq >/dev/null; then
  echo "jq is not installed; the sync needs it to post results to Slack." >&2
  exit 1
fi

notify_slack() {
  curl --silent --show-error --fail --max-time 10 \
    --retry 3 --retry-connrefused \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg text "$1" '{text: $text}')" \
    "$SLACK_WEBHOOK_URL" >/dev/null \
    || echo "[$(date)] ==> WARNING: could not post to Slack."
}

# cleanup reads paths built further down, so it can't be the trap yet. This one
# reports the only startup failure that can reach Slack, a db-sync.env that
# loads but is missing a variable.
report_startup_failure() {
  notify_slack ":x: prod → staging: FAILED during startup, before the sync \
began. Check db-sync.env on the staging host. Staging still holds the data from \
its previous successful sync."
  exit 1
}
trap report_startup_failure EXIT

: "${PROD_DB_USER:?missing in db-sync.env}" \
  "${PROD_DB_PASSWORD:?missing in db-sync.env}" \
  "${PROD_DB_HOST:?missing in db-sync.env}" \
  "${PROD_DB_NAME:?missing in db-sync.env}" \
  "${STAGING_DB_USER:?missing in db-sync.env}" \
  "${STAGING_DB_PASSWORD:?missing in db-sync.env}" \
  "${STAGING_DB_HOST:?missing in db-sync.env}" \
  "${STAGING_DB_NAME:?missing in db-sync.env}" \
  "${STAGING_PASSWORD_HASH:?missing in db-sync.env}" \
  "${PROD_ASSETS_BUCKET:?missing in db-sync.env}" \
  "${STAGING_ASSETS_BUCKET:?missing in db-sync.env}"

PROD_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@${PROD_DB_HOST}:5432/${PROD_DB_NAME}"

STAGING_ADMIN_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/postgres"

SCRATCH_DB="${STAGING_DB_NAME}_sync"
SCRATCH_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/${SCRATCH_DB}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/home/ec2-user/prod_dump_${TIMESTAMP}.pgcustom"

SWAP_STARTED=0
STAGE="startup"

# The dump file and the scratch database both hold unanonymized prod data, so
# every exit path has to take them with it — until the swap starts, after which
# the (anonymized) scratch database may be the only surviving copy.
cleanup() {
  local status=$?

  rm -f "$DUMP_FILE"

  if [ "$SWAP_STARTED" -eq 0 ]; then
    psql "$STAGING_ADMIN_URL" -q \
      -c "DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE);" >/dev/null 2>&1 \
      || echo "[$(date)] ==> WARNING: could not drop ${SCRATCH_DB}; it may still" \
        "hold unanonymized prod data."
  fi

  local emoji outcome

  if [ "$status" -eq 0 ]; then
    emoji=":white_check_mark:"
    outcome="Sync completed successfully."
  elif [ "$SWAP_STARTED" -eq 1 ]; then
    emoji=":x:"
    outcome="FAILED during ${STAGE} (exit ${status}) at or after the swap. \
If ${STAGING_DB_NAME} no longer exists, recover with: \
ALTER DATABASE ${SCRATCH_DB} RENAME TO ${STAGING_DB_NAME};"
  else
    emoji=":x:"
    outcome="FAILED during ${STAGE} (exit ${status}). Staging still holds the \
data from its previous successful sync."
  fi

  echo "[$(date)] ==> ${outcome}"
  notify_slack "${emoji} prod → staging: ${outcome}"
}
trap cleanup EXIT

trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

BCRYPT_PATTERN='^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
if [[ ! $STAGING_PASSWORD_HASH =~ $BCRYPT_PATTERN ]]; then
  echo "STAGING_PASSWORD_HASH is not a bcrypt hash — single-quote it in" \
    "db-sync.env so the shell doesn't expand the \$-delimited fields." >&2
  exit 1
fi

echo "[$(date)] ==> Starting prod → staging sync"
STAGE="dump"
echo "[$(date)] ==> Dumping prod database to ${DUMP_FILE}..."

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  "$PROD_URL" \
  --file="$DUMP_FILE"

STAGE="scratch database"
echo "[$(date)] ==> Recreating scratch database ${SCRATCH_DB}..."

psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE);
CREATE DATABASE ${SCRATCH_DB} WITH TEMPLATE=template0 ENCODING='UTF8';
SQL

STAGE="restore"
echo "[$(date)] ==> Restoring dump into ${SCRATCH_DB}..."

pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$SCRATCH_URL" \
  "$DUMP_FILE"

STAGE="anonymize"
echo "[$(date)] ==> Anonymizing ${SCRATCH_DB}..."

psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -v password_hash="$STAGING_PASSWORD_HASH" <<'SQL'
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
UPDATE "user" SET "password" = :'password_hash';

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
UPDATE "user_device" SET "expoPushToken" = NULL;
UPDATE "push" SET "expoPushToken" = 'pruned';

SQL

STAGE="swap"
echo "[$(date)] ==> Swapping ${SCRATCH_DB} into place as ${STAGING_DB_NAME}..."

SWAP_STARTED=1
psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${SCRATCH_DB}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${STAGING_DB_NAME} WITH (FORCE);
ALTER DATABASE ${SCRATCH_DB} RENAME TO ${STAGING_DB_NAME};
SQL

STAGE="s3 sync"
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

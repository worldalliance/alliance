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

# The locks taken below live on the open file description rather than the
# process, so every child inherits them: an orphaned pg_dump would hold the sync
# lock after a kill and skip every run that follows, and an orphaned migration
# would hold ~/migrate.lock against the deploy. Anything that can outlive the
# shell runs through here. Startup aborts that run before either lock exists
# close fds nothing opened, which is a no-op.
unlocked() {
  "$@" 200>&- 201>&-
}

notify_slack() {
  unlocked curl --silent --show-error --fail --max-time 10 \
    --retry 3 --retry-connrefused \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg text "$1" '{text: $text}')" \
    "$SLACK_WEBHOOK_URL" >/dev/null \
    || echo "[$(date)] ==> WARNING: could not post to Slack."
}

# A Slack message only reports a run that lived long enough to send it. A
# SIGKILL, a dead host, or a cron that never fires sends nothing at all, so the
# ping that never arrives has to be what raises the alarm.
#
# The startup trap fires above the HEALTHCHECK_URL check, so an unset variable
# is a no-op here instead of a curl error about a URL with no host.
ping_healthcheck() {
  local base="${HEALTHCHECK_URL:-}"
  [ -n "$base" ] || return 0
  unlocked curl --silent --show-error --fail --max-time 10 \
    --retry 3 --retry-connrefused --retry-max-time 30 \
    "${base%/}${1:-}" >/dev/null \
    || echo "[$(date)] ==> WARNING: could not ping the healthcheck."
}

# The startup trap is installed below, so a failure up here reports for itself.
abort_before_start() {
  echo "[$(date)] ==> $1" >&2
  notify_slack ":x: prod → staging: $1"
  ping_healthcheck /fail
  exit 1
}

if ! command -v flock >/dev/null; then
  abort_before_start "flock is not installed; the sync needs it to stop two \
runs from overlapping."
fi

LOCK_FILE=/home/ec2-user/sync_prod_to_staging.lock
if ! true >>"$LOCK_FILE"; then
  abort_before_start "cannot write ${LOCK_FILE}; the sync needs it to stop two \
runs from overlapping."
fi

# Two runs share one scratch database and one staging database, so an overlap
# corrupts both, and in the worst order one run renames the other's
# half-restored, still unanonymized database into place as staging.
exec 200>>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[$(date)] ==> Another sync is already running; skipping this one."
  notify_slack ":no_entry: prod → staging: another sync is already running; \
skipping this one."
  exit 0
fi

DB_CA_FILE=/home/ec2-user/db-ca.pem
if [ ! -s "$DB_CA_FILE" ]; then
  abort_before_start "${DB_CA_FILE} is missing or empty; the backend deploy \
writes it from DB_CA_CERT."
fi

# cleanup reads paths built further down, so it can't be the trap yet. This one
# reports a db-sync.env that loads but doesn't hold what the sync needs.
report_startup_failure() {
  notify_slack ":x: prod → staging: FAILED during startup, before the sync \
began. Check db-sync.env on the staging host. Staging still holds the data from \
its previous successful sync."
  ping_healthcheck /fail
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
  "${STAGING_ASSETS_BUCKET:?missing in db-sync.env}" \
  "${HEALTHCHECK_URL:?missing in db-sync.env}"

BCRYPT_PATTERN='^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
if [[ ! $STAGING_PASSWORD_HASH =~ $BCRYPT_PATTERN ]]; then
  echo "STAGING_PASSWORD_HASH is not a bcrypt hash — single-quote it in" \
    "db-sync.env so the shell doesn't expand the \$-delimited fields." >&2
  exit 1
fi

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
    unlocked psql "$STAGING_ADMIN_URL" -q \
      -c "DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE);" \
      >/dev/null 2>&1 \
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
  notify_slack "${emoji} prod → staging (${TIMESTAMP}): ${outcome}"

  if [ "$status" -eq 0 ]; then
    ping_healthcheck
  else
    ping_healthcheck /fail
  fi
}
trap cleanup EXIT

trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

echo "[$(date)] ==> Starting prod → staging sync"
notify_slack ":hourglass_flowing_sand: prod → staging (${TIMESTAMP}): sync started."
ping_healthcheck /start

STAGE="dump"
echo "[$(date)] ==> Dumping prod database to ${DUMP_FILE}..."

unlocked pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  "$PROD_URL" \
  --file="$DUMP_FILE"

STAGE="scratch database"
echo "[$(date)] ==> Recreating scratch database ${SCRATCH_DB}..."

unlocked psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE);
CREATE DATABASE ${SCRATCH_DB} WITH TEMPLATE=template0 ENCODING='UTF8';
SQL

STAGE="restore"
echo "[$(date)] ==> Restoring dump into ${SCRATCH_DB}..."

unlocked pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$SCRATCH_URL" \
  "$DUMP_FILE"

STAGE="anonymize"
echo "[$(date)] ==> Anonymizing ${SCRATCH_DB}..."

unlocked psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 --single-transaction \
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

SQL

# The backend deploy holds this lock from replacing ~/nest-backend until the new
# code passes its health check or rolls back, so it can't migrate the database
# the swap is about to drop.
STAGE="migrate lock"
exec 201>>/home/ec2-user/migrate.lock
flock -w 900 201

# Prod's schema lags the code deployed to staging by every migration that
# hasn't shipped to production yet. Migrating after anonymizing means a migration
# that copies member data only ever copies anonymized values.
STAGE="migrations"
echo "[$(date)] ==> Running staging's migrations on ${SCRATCH_DB}..."

unlocked env -C /home/ec2-user/nest-backend/server \
  NODE_ENV=staging \
  DB_HOST="$STAGING_DB_HOST" \
  DB_NAME="$SCRATCH_DB" \
  DB_USERNAME="$STAGING_DB_USER" \
  DB_PASSWORD="$STAGING_DB_PASSWORD" \
  DB_CA_CERT="$(cat "$DB_CA_FILE")" \
  /home/ec2-user/.bun/bin/bunx typeorm-ts-node-commonjs \
  --dataSource src/datasources/dataSource.ts migration:run

STAGE="swap"
echo "[$(date)] ==> Swapping ${SCRATCH_DB} into place as ${STAGING_DB_NAME}..."

SWAP_STARTED=1
unlocked psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${SCRATCH_DB}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${STAGING_DB_NAME} WITH (FORCE);
ALTER DATABASE ${SCRATCH_DB} RENAME TO ${STAGING_DB_NAME};
SQL
exec 201>&-

STAGE="s3 sync"
echo "[$(date)] ==> S3 sync s3://$PROD_ASSETS_BUCKET -> s3://$STAGING_ASSETS_BUCKET"

unlocked aws s3 sync \
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

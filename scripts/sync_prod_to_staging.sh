#!/usr/bin/env bash
#
# This script runs on the staging host from deploy/systemd/alliance-prod-to-staging-sync.timer

set -euo pipefail

umask 077

# Runs itself again with its secrets loaded, so a run started by hand gets them
# too. A failure to load alerts only through the missing healthcheck ping.
SECRETS_PATH=/alliance/staging/db-sync/
SYNC_KEYS=(SLACK_WEBHOOK_URL HEALTHCHECK_URL PROD_DB_HOST PROD_DB_USER
  PROD_DB_PASSWORD PROD_ASSETS_BUCKET STAGING_PASSWORD_HASH)
SERVER_KEYS=(DB_HOST DB_USERNAME DB_PASSWORD ASSETS_BUCKET)
if [ -z "${SYNC_SECRETS_LOADED:-}" ]; then
  exec /home/ec2-user/secrets_run.sh \
    --path "$SECRETS_PATH" "${SYNC_KEYS[@]}" \
    --path /alliance/staging/server/ "${SERVER_KEYS[@]}" \
    -- env SYNC_SECRETS_LOADED=1 bash "$0" "$@"
fi
# The wrapper exports what it loads; a child gets only the logins passed to it.
export -n "${SYNC_KEYS[@]}" "${SERVER_KEYS[@]}"

# curl reads these from a config line, where a quote, backslash or line break
# would end the URL or add options.
URL_PATTERN='^https?://[^"\[:space:]]+$'
for key in SLACK_WEBHOOK_URL HEALTHCHECK_URL; do
  if [[ ! ${!key} =~ $URL_PATTERN ]]; then
    echo "${SECRETS_PATH}${key} is not an http(s) URL without quotes, \
backslashes or whitespace." >&2
    exit 1
  fi
done

if ! command -v jq >/dev/null; then
  echo "jq is not installed; the sync needs it to post results to Slack." >&2
  exit 1
fi

# The locks taken below live on the open file description rather than the
# process, so every child inherits them: an orphaned pg_dump would hold the sync
# lock after a kill and skip every run that follows, and an orphaned migration
# would hold ~/migrate.lock against the deploy. Anything that can outlive the
# shell runs through here.
unlocked() {
  "$@" 200>&- 201>&-
}

notify_slack() {
  unlocked curl --silent --show-error --fail --max-time 10 \
    --retry 3 --retry-connrefused \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg text "$1" '{text: $text}')" \
    --config - <<<"url = \"${SLACK_WEBHOOK_URL}\"" >/dev/null \
    || echo "[$(date)] ==> WARNING: could not post to Slack."
}

# A Slack message only reports a run that lived long enough to send it. A
# SIGKILL, a dead host, or a timer that never fires sends nothing at all, so the
# ping that never arrives has to be what raises the alarm.
ping_healthcheck() {
  unlocked curl --silent --show-error --fail --max-time 10 \
    --retry 3 --retry-connrefused --retry-max-time 30 \
    --config - <<<"url = \"${HEALTHCHECK_URL%/}${1:-}\"" >/dev/null \
    || echo "[$(date)] ==> WARNING: could not ping the healthcheck."
}

# The startup trap is installed below, so a failure up here reports for itself.
abort_before_start() {
  echo "[$(date)] ==> $1" >&2
  notify_slack ":x: prod → staging: $1"
  ping_healthcheck /fail
  exit 1
}

# systemd can start the service off schedule: a deploy that edits OnCalendar=,
# or starts a timer someone stopped. Only the service unit sets
# SYNC_SCHEDULED_AT, so a run outside it, such as through systemd-run, is never
# skipped. No healthcheck ping on a skip, so a schedule that drifts from
# SYNC_SCHEDULED_AT skips every run and the switch alerts.
if [ -n "${SYNC_SCHEDULED_AT:-}" ]; then
  if [[ ! $SYNC_SCHEDULED_AT =~ ^([01][0-9]|2[0-3]):([0-5][0-9])$ ]]; then
    abort_before_start "SYNC_SCHEDULED_AT=${SYNC_SCHEDULED_AT} in the service \
unit is not HH:MM; skipping this run."
  fi
  scheduled=$((10#${BASH_REMATCH[1]} * 60 + 10#${BASH_REMATCH[2]}))
  # A failed arithmetic expansion abandons this whole block without exiting,
  # which would run the sync unguarded.
  now_epoch=$(date -u +%s)
  if [[ ! $now_epoch =~ ^[0-9]+$ ]]; then
    abort_before_start "date -u +%s printed '${now_epoch}', not a number; \
skipping this run."
  fi
  now_epoch_minute=$((now_epoch / 60))
  now=$(printf '%02d:%02d' $((now_epoch_minute % 1440 / 60)) $((now_epoch_minute % 60)))
  minutes_late=$(((now_epoch_minute % 1440 - scheduled + 1440) % 1440))
  WINDOW_MINUTES=5
  RUN_NOW="sudo systemd-run --uid=ec2-user --collect \
--unit=alliance-prod-to-staging-sync-manual /home/ec2-user/sync_prod_to_staging.sh"
  if [ "$minutes_late" -ge "$WINDOW_MINUTES" ]; then
    echo "[$(date)] ==> systemd started this run at ${now} UTC, outside its \
window of ${WINDOW_MINUTES} minutes from ${SYNC_SCHEDULED_AT} UTC; skipping it."
    notify_slack ":no_entry: prod → staging: skipped a run systemd started at \
${now} UTC, outside its window of ${WINDOW_MINUTES} minutes from \
${SYNC_SCHEDULED_AT} UTC. To sync now, run \`${RUN_NOW}\` on the staging host."
    exit 0
  fi
  slot_day=$(((now_epoch_minute - minutes_late) / 1440))
  SLOT_FILE=/home/ec2-user/sync_prod_to_staging.slot
  if [ "$(cat "$SLOT_FILE" 2>/dev/null)" = "$slot_day" ]; then
    echo "[$(date)] ==> systemd started this run at ${now} UTC, after that \
day's run had already started; skipping it."
    notify_slack ":no_entry: prod → staging: skipped a run systemd started at \
${now} UTC, after that day's run had already started. To sync again, run \
\`${RUN_NOW}\` on the staging host."
    exit 0
  fi
  if ! echo "$slot_day" >"$SLOT_FILE"; then
    abort_before_start "cannot write ${SLOT_FILE}; the sync needs it to run \
once a day."
  fi
fi

if ! command -v flock >/dev/null; then
  abort_before_start "flock is not installed; the sync needs it to stop two \
runs from overlapping."
fi

LOCK_FILE=/home/ec2-user/sync_prod_to_staging.lock
MIGRATE_LOCK=/home/ec2-user/migrate.lock
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

# The deploy holds ~/migrate.lock while it replaces ~/nest-backend, which
# deployed-db-name.ts and its node_modules come from. The anonymize scripts and
# the RDS certificate bundle are read after this lock is released, so they are
# copied out under it.
SYNC_FILES=/home/ec2-user/sync_prod_to_staging.files
RDS_BUNDLE=rds-us-west-2-bundle.pem
if ! true >>"$MIGRATE_LOCK"; then
  abort_before_start "cannot write ~/migrate.lock; the sync needs it to read \
its database names and copy its files out of ~/nest-backend."
fi
db_name_of() {
  unlocked /home/ec2-user/.bun/bin/bun \
    /home/ec2-user/nest-backend/scripts/deployed-db-name.ts "$1"
}
{
  if ! flock -w 900 201; then
    abort_before_start "a backend deploy held ~/migrate.lock for 15 minutes, \
so the sync could not read its database names or copy its files out of \
~/nest-backend."
  fi
  if ! PROD_DB_NAME=$(db_name_of production) \
    || ! STAGING_DB_NAME=$(db_name_of staging) \
    || [ -z "$PROD_DB_NAME" ] || [ -z "$STAGING_DB_NAME" ]; then
    abort_before_start "could not read both database names through \
~/nest-backend/scripts/deployed-db-name.ts, which failed or printed an empty \
name; the sync's journal on the staging host has any error."
  fi
  if ! rm -rf "$SYNC_FILES/anonymize" || ! mkdir -p "$SYNC_FILES" \
    || ! cp -R /home/ec2-user/nest-backend/scripts/anonymize \
      /home/ec2-user/nest-backend/server/src/config/$RDS_BUNDLE \
      "$SYNC_FILES/"; then
    abort_before_start "could not copy scripts/anonymize and the RDS \
certificate bundle from ~/nest-backend to ${SYNC_FILES}."
  fi
} 201>>"$MIGRATE_LOCK"

# cleanup reads paths built further down, so it can't be the trap yet.
report_startup_failure() {
  notify_slack ":x: prod → staging: FAILED during startup, before the sync \
began. Check its journal on the staging host and its parameters under \
${SECRETS_PATH}. Staging still holds the data from its previous successful sync."
  ping_healthcheck /fail
  exit 1
}
trap report_startup_failure EXIT

# shellcheck disable=SC2016 # a regex, not an expansion
BCRYPT_PATTERN='^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
if [[ ! $STAGING_PASSWORD_HASH =~ $BCRYPT_PATTERN ]]; then
  echo "${SECRETS_PATH}STAGING_PASSWORD_HASH is not a bcrypt hash." >&2
  exit 1
fi

STAGING_DB_HOST=$DB_HOST
STAGING_DB_USER=$DB_USERNAME
STAGING_DB_PASSWORD=$DB_PASSWORD
STAGING_ASSETS_BUCKET=$ASSETS_BUCKET
SCRATCH_DB="${STAGING_DB_NAME}_sync"

# On Linux only the process's own user and root can read its environment, so
# libpq takes the logins from there rather than argv or a password file on disk.
prod_pg() {
  PGHOST=$PROD_DB_HOST PGUSER=$PROD_DB_USER PGPASSWORD=$PROD_DB_PASSWORD \
    PGDATABASE=$PROD_DB_NAME PGSSLMODE=verify-full \
    PGSSLROOTCERT="$SYNC_FILES/$RDS_BUNDLE" "$@"
}

staging_pg() {
  local database=$1
  shift
  PGHOST=$STAGING_DB_HOST PGUSER=$STAGING_DB_USER PGPASSWORD=$STAGING_DB_PASSWORD \
    PGDATABASE=$database PGSSLMODE=verify-full \
    PGSSLROOTCERT="$SYNC_FILES/$RDS_BUNDLE" "$@"
}

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
    unlocked staging_pg postgres psql -q \
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

unlocked prod_pg pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE"

STAGE="scratch database"
echo "[$(date)] ==> Recreating scratch database ${SCRATCH_DB}..."

unlocked staging_pg postgres psql -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE);
CREATE DATABASE ${SCRATCH_DB} WITH TEMPLATE=template0 ENCODING='UTF8';
SQL

STAGE="restore"
echo "[$(date)] ==> Restoring dump into ${SCRATCH_DB}..."

unlocked staging_pg "$SCRATCH_DB" pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$SCRATCH_DB" \
  "$DUMP_FILE"

STAGE="anonymize"
echo "[$(date)] ==> Anonymizing ${SCRATCH_DB}..."

# The hash goes in on stdin, where ps can't show it. BCRYPT_PATTERN admits no
# quote or backslash, which is what keeps it inside the quotes.
unlocked staging_pg "$SCRATCH_DB" psql -v ON_ERROR_STOP=1 --single-transaction \
  -f - <<SQL
\set password_hash '${STAGING_PASSWORD_HASH}'
\set in_anonymize_dir
\cd '${SYNC_FILES}/anonymize'
\i anonymize.sql
SQL

# The backend deploy holds this lock from replacing ~/nest-backend until the new
# code passes its health check or rolls back, so it can't migrate the database
# the swap is about to drop.
STAGE="migrate lock"
exec 201>>"$MIGRATE_LOCK"
flock -w 900 201

# Prod's schema lags the code deployed to staging by every migration that
# hasn't shipped to production yet. Migrating after anonymizing means a migration
# that copies member data only ever copies anonymized values.
STAGE="migrations"
echo "[$(date)] ==> Running staging's migrations on ${SCRATCH_DB}..."

NODE_ENV=staging \
  DB_HOST="$STAGING_DB_HOST" \
  DB_NAME="$SCRATCH_DB" \
  DB_USERNAME="$STAGING_DB_USER" \
  DB_PASSWORD="$STAGING_DB_PASSWORD" \
  unlocked env -C /home/ec2-user/nest-backend/server \
  /home/ec2-user/.bun/bin/bunx typeorm-ts-node-commonjs \
  --dataSource src/datasources/dataSource.ts migration:run

STAGE="swap"
echo "[$(date)] ==> Swapping ${SCRATCH_DB} into place as ${STAGING_DB_NAME}..."

SWAP_STARTED=1
unlocked staging_pg postgres psql -v ON_ERROR_STOP=1 <<SQL
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
  --exclude 'mms-media/*' \
  --only-show-errors \
  --size-only

SYNC_EXIT=$?
if [ $SYNC_EXIT -ne 0 ]; then
  echo "[$(date)] S3 sync failed with exit code $SYNC_EXIT"
  exit $SYNC_EXIT
fi

echo "[$(date)] ==> S3 sync complete."

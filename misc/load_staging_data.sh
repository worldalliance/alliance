#!/usr/bin/env bash
set -euo pipefail

SSH_HOST_ALIAS="${SSH_HOST_ALIAS:-staging}"

REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-/home/ec2-user/db-sync.env}"

LOCAL_DB_NAME="${LOCAL_DB_NAME:-alliance}"

LOCAL_PGHOST="${LOCAL_PGHOST:-localhost}"
LOCAL_PGPORT="${LOCAL_PGPORT:-5432}"
LOCAL_PGUSER="${LOCAL_PGUSER:-postgres}"

RESET_LOCAL_DB="${RESET_LOCAL_DB:-1}"

DUMP_DIR="${DUMP_DIR:-./db_dumps}"

timestamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DUMP_DIR"

dump_file="${DUMP_DIR}/staging_dump_${timestamp}.pgcustom"

echo "==> Creating dump from staging via SSH host: ${SSH_HOST_ALIAS}"
echo "==> Remote env file: ${REMOTE_ENV_FILE}"
echo "==> Saving dump to: ${dump_file}"

# Stream pg_dump from remote -> local file
ssh -o BatchMode=yes "$SSH_HOST_ALIAS" "bash -lc '
  set -euo pipefail
  source \"${REMOTE_ENV_FILE}\"

  STAGING_URL=\"postgresql://\${STAGING_DB_USER}:\${STAGING_DB_PASSWORD}@\${STAGING_DB_HOST}:5432/\${STAGING_DB_NAME}\"

  exec pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    \"\$STAGING_URL\"
'" > "$dump_file"

echo "==> Dump downloaded OK"

# Optionally reset local DB
if [[ "$RESET_LOCAL_DB" == "1" ]]; then
  echo "==> Dropping & recreating local DB: ${LOCAL_DB_NAME}"
  # Connect to postgres maintenance DB for drop/create
  PGPASSWORD="${LOCAL_PGPASSWORD:-}" \
  psql \
    -h "$LOCAL_PGHOST" -p "$LOCAL_PGPORT" -U "$LOCAL_PGUSER" \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${LOCAL_DB_NAME}\";" \
    -c "CREATE DATABASE \"${LOCAL_DB_NAME}\";"
fi

echo "==> Restoring into local DB: ${LOCAL_DB_NAME}"

# Restore from custom-format dump
PGPASSWORD="${LOCAL_PGPASSWORD:-}" \
pg_restore \
  -h "$LOCAL_PGHOST" -p "$LOCAL_PGPORT" -U "$LOCAL_PGUSER" \
  --no-owner \
  -d "$LOCAL_DB_NAME" \
  "$dump_file"

echo "==> Done ✅"
echo "    Local DB restored: ${LOCAL_DB_NAME}"
echo "    Dump file: ${dump_file}"

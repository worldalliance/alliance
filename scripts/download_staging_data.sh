#!/usr/bin/env bash
set -euo pipefail

SSH_HOST_ALIAS="${SSH_HOST_ALIAS:-staging}"

REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-/home/ec2-user/db-sync.env}"

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

echo "==> Dump downloaded OK: ${dump_file}"
echo "==> To restore, run: ./scripts/restore_staging_data.sh ${dump_file}"

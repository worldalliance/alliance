#!/usr/bin/env bash
set -euo pipefail

SSH_HOST_ALIAS="${SSH_HOST_ALIAS:-staging}"

DUMP_DIR="${DUMP_DIR:-./db_dumps}"

timestamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DUMP_DIR"

dump_file="${DUMP_DIR}/staging_dump_${timestamp}.pgcustom"

echo "==> Creating dump from staging via SSH host: ${SSH_HOST_ALIAS}"
echo "==> Saving dump to: ${dump_file}"

ssh "$SSH_HOST_ALIAS" \
  "bash nest-backend/scripts/with_db_env.sh staging pg_dump --format=custom --no-owner --no-privileges" \
  > "$dump_file"

echo "==> Dump downloaded OK: ${dump_file}"
echo "==> To restore, run: ./scripts/restore_staging_data.sh ${dump_file}"

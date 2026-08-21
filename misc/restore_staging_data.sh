#!/usr/bin/env bash
set -euo pipefail

DUMP_FILE="${1:?Usage: $0 <path-to-dump-file>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_ENV="$REPO_ROOT/server/.env"

# shellcheck source=scripts/lib/env-value.sh
source "$REPO_ROOT/scripts/lib/env-value.sh"

LOCAL_DB_NAME="${LOCAL_DB_NAME:-$(env_value "$SERVER_ENV" DB_NAME)}"

LOCAL_PGHOST="${LOCAL_PGHOST:-localhost}"
LOCAL_PGPORT="${LOCAL_PGPORT:-5432}"
LOCAL_PGUSER="${LOCAL_PGUSER:-postgres}"

RESET_LOCAL_DB="${RESET_LOCAL_DB:-1}"

if [[ -z "$LOCAL_DB_NAME" ]]; then
  echo "Error: DB_NAME not set in ${SERVER_ENV}, so there is no database this checkout owns." >&2
  echo "       Set it there, or export LOCAL_DB_NAME to name the database to overwrite." >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Error: dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

# Optionally reset local DB
if [[ "$RESET_LOCAL_DB" == "1" ]]; then
  echo "==> Dropping & recreating local DB: ${LOCAL_DB_NAME} on ${LOCAL_PGHOST}:${LOCAL_PGPORT}"
  PGPASSWORD="${LOCAL_PGPASSWORD:-}" \
  psql \
    -h "$LOCAL_PGHOST" -p "$LOCAL_PGPORT" -U "$LOCAL_PGUSER" \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${LOCAL_DB_NAME}\";" \
    -c "CREATE DATABASE \"${LOCAL_DB_NAME}\";"
fi

echo "==> Restoring into local DB: ${LOCAL_DB_NAME} on ${LOCAL_PGHOST}:${LOCAL_PGPORT}"

PGPASSWORD="${LOCAL_PGPASSWORD:-}" \
pg_restore \
  -h "$LOCAL_PGHOST" -p "$LOCAL_PGPORT" -U "$LOCAL_PGUSER" \
  --no-owner \
  -d "$LOCAL_DB_NAME" \
  "$DUMP_FILE"

echo "==> Done ✅"
echo "    Local DB restored: ${LOCAL_DB_NAME} on ${LOCAL_PGHOST}:${LOCAL_PGPORT}"
echo "    Dump file used: ${DUMP_FILE}"

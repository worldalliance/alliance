#!/usr/bin/env bash
#
# Re-dump citesting/fixtures/seed_dataonly.sql after schema changes.
#
# When new migrations rename/drop columns or tables, the seed dump becomes
# stale and CI fails loading it. This script:
#
#   1. Reads seed_migration_timestamp.txt — the last migration applied when
#      the seed was generated — and counts how many newer migrations exist.
#   2. Creates a temp DB and runs every migration.
#   3. Reverts the newer migrations so the schema matches the existing seed.
#   4. Loads the existing seed.
#   5. Re-runs the reverted migrations so the data is carried across the
#      rename/drop/etc.
#   6. Dumps data only, overwrites seed_dataonly.sql, and updates
#      seed_migration_timestamp.txt to the latest migration on disk.
#
# Usage:
#   citesting/scripts/reseed.sh [--revert N]
#
# --revert N overrides the auto-detected count (e.g. if the timestamp file
# is missing or you need to revert past data-loading migrations).

set -euo pipefail

REVERT_COUNT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --revert)
      REVERT_COUNT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,23p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SEED_FILE="$REPO_ROOT/citesting/fixtures/seed_dataonly.sql"
SEED_TIMESTAMP_FILE="$REPO_ROOT/citesting/fixtures/seed_migration_timestamp.txt"
MIGRATIONS_DIR="$REPO_ROOT/server/migrations"

# Latest migration timestamp on disk (just the leading number from the filename).
latest_migration_timestamp() {
  basename "$(ls "$MIGRATIONS_DIR" | grep -E '^[0-9]+-' | sort -n | tail -1)" \
    | sed -E 's/^([0-9]+)-.*/\1/'
}

# Count migrations strictly newer than $1.
count_migrations_after() {
  local since="$1"
  ls "$MIGRATIONS_DIR" \
    | grep -E '^[0-9]+-' \
    | sed -E 's/^([0-9]+)-.*/\1/' \
    | awk -v since="$since" '$1 > since' \
    | wc -l \
    | tr -d ' '
}

if [[ -z "$REVERT_COUNT" ]]; then
  if [[ ! -f "$SEED_TIMESTAMP_FILE" ]]; then
    echo "no $SEED_TIMESTAMP_FILE; pass --revert N or create it first" >&2
    exit 2
  fi
  SEED_TIMESTAMP="$(tr -d '[:space:]' < "$SEED_TIMESTAMP_FILE")"
  REVERT_COUNT="$(count_migrations_after "$SEED_TIMESTAMP")"
  echo "Seed was generated at migration $SEED_TIMESTAMP; $REVERT_COUNT newer migration(s) on disk."
  if [[ "$REVERT_COUNT" -eq 0 ]]; then
    echo "Nothing to do — seed is already up to date."
    exit 0
  fi
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
# Resolve from REPO_ROOT, so the name matches the checkout whose
# migrations run below.
DB_NAME="$(cd "$REPO_ROOT" && bun scripts/ports.ts reseed-database)"

export PGPASSWORD="$DB_PASSWORD"
PSQL_BASE=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME")

# Tables populated by migrations, not seed data. Excluding them avoids
# duplicate-key conflicts when the seed loads on a freshly-migrated DB.
EXCLUDE_TABLE_DATA=(migrations contract)

run_migration() {
  local cmd="$1" # run | revert
  DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" \
  DB_USERNAME="$DB_USERNAME" DB_PASSWORD="$DB_PASSWORD" \
  DB_NAME="$DB_NAME" NODE_ENV=test \
    bun run --cwd "$REPO_ROOT/server" "migration:$cmd"
}

echo "==> Recreating DB $DB_NAME"
"${PSQL_BASE[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\""
"${PSQL_BASE[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\""

echo "==> Running all migrations"
run_migration run >/dev/null

echo "==> Reverting last $REVERT_COUNT migration(s)"
for ((i=0; i<REVERT_COUNT; i++)); do
  run_migration revert >/dev/null
done

echo "==> Loading existing seed (FKs disabled via session_replication_role)"
{
  echo "SET session_replication_role = 'replica';"
  # Strip pg17-only constructs so the dump replays on older Postgres versions
  # (matches the stripping the screenshot runner does at load time).
  sed -E '/^SET[[:space:]]+transaction_timeout[[:space:]]*=/d; /^\\restrict([[:space:]]|$)/d; /^\\unrestrict([[:space:]]|$)/d' "$SEED_FILE"
  echo "SET session_replication_role = 'origin';"
} | "${PSQL_BASE[@]}" -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null

echo "==> Re-running migrations to apply schema changes on top of seed data"
run_migration run >/dev/null

echo "==> Dumping data to $SEED_FILE"
EXCLUDE_ARGS=()
for t in "${EXCLUDE_TABLE_DATA[@]}"; do
  EXCLUDE_ARGS+=(--exclude-table-data="$t")
done
SEED_TMP="$(mktemp "$SEED_FILE.XXXXXX")"
trap 'rm -f "$SEED_TMP"' EXIT
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" \
  --data-only --no-owner --no-privileges \
  "${EXCLUDE_ARGS[@]}" \
  > "$SEED_TMP"
mv "$SEED_TMP" "$SEED_FILE"
trap - EXIT

echo "==> Updating $SEED_TIMESTAMP_FILE"
latest_migration_timestamp > "$SEED_TIMESTAMP_FILE"

echo "==> Dropping temp DB $DB_NAME"
"${PSQL_BASE[@]}" -d postgres -c "DROP DATABASE \"$DB_NAME\""

echo "Done. Review the diff in $SEED_FILE before committing."

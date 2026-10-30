#!/usr/bin/env bash
# Postgres access for new-worktree.sh and rm-worktree.sh. Source after
# env-value.sh and worktree-paths.sh.

load_main_db_settings() {
  source_env="$main_root/server/.env"
  [[ -f "$source_env" ]] || die "$source_env not found — copy server/.env.example first"

  source_db="$(env_value "$source_env" DB_NAME)"
  db_host="$(env_value "$source_env" DB_HOST)"
  db_port="$(env_value "$source_env" DB_PORT)"
  db_user="$(env_value "$source_env" DB_USERNAME)"
  db_password="$(env_value "$source_env" DB_PASSWORD)"

  # DB_PASSWORD stays optional — a local cluster may use trust or peer auth.
  [[ -n "$db_host" ]] || die "DB_HOST not set in $source_env"
  [[ -n "$db_port" ]] || die "DB_PORT not set in $source_env"
  [[ -n "$db_user" ]] || die "DB_USERNAME not set in $source_env"
  [[ -n "$source_db" ]] || die "DB_NAME not set in $source_env"

  local tool
  for tool in psql createdb dropdb pg_dump; do
    command -v "$tool" >/dev/null || die "$tool not found — install the postgres client tools"
  done

  if [[ -n "$db_password" ]]; then export PGPASSWORD="$db_password"; fi
  psql_args=(-h "$db_host" -p "$db_port" -U "$db_user")
  psql "${psql_args[@]}" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1 ||
    die "cannot reach postgres at $db_host:$db_port as $db_user (credentials from $source_env)"
}

# The database comment marking a database as owned by record $1.
db_owner_tag() { echo "alliance-worktree:$1"; }

# Creation makes each database under this name, or it with _test appended, which
# only record $1 derives, and renames it once tagged.
staging_db_for() { echo "alliance_wt_${1//-/}"; }

db_exists() {
  [[ "$(psql "${psql_args[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$1'")" == 1 ]]
}

# Prints "absent" or "comment:<comment>". Callers pass names derived from a
# valid worktree name or record id, which need no quoting.
db_comment() {
  local row
  row="$(psql -X "${psql_args[@]}" -d postgres -tAc \
    "SELECT 'comment:' || coalesce(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname='$1'")" ||
    return 1
  echo "${row:-absent}"
}

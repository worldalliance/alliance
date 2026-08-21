#!/usr/bin/env bash
# Creates a git worktree that runs completely independently of the main
# checkout: its own server/frontend/admin/metro ports and its own local
# database.
#
# Only works in the main checkout. Inside a worktree it exits.
#
# Usage: scripts/new-worktree.sh <name> [options]
#
#   --branch <branch>  branch to create or check out (default: <name>)
#   --from <ref>       base the new branch on <ref> (default: HEAD)
#   --slot <n>         port slot (default: lowest free slot)
#   --force            take --slot even if another worktree already claims it
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "error: $*" >&2; exit 1; }

# shellcheck source=scripts/lib/env-value.sh
source "$repo_root/scripts/lib/env-value.sh"

# Assign first: `eval "$(...)"` succeeds on empty output, so a failure here would
# surface further down as an unbound variable naming none of this.
bases="$(bun "$repo_root/scripts/ports.ts" --base)" ||
  die "scripts/ports.ts --base failed, so the port bases for a slot are unknown"
eval "$bases"
MAX_SLOT="$MAX_PORT_SLOT"

git_common_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir)"
main_root="$(cd "$(dirname "$git_common_dir")" && pwd)"

usage() {
  awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0"
}

name=""
branch=""
from="HEAD"
slot=""
force=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) branch="${2:-}"; shift 2 ;;
    --from) from="${2:-}"; shift 2 ;;
    --slot) slot="${2:-}"; shift 2 ;;
    --force) force=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [[ -n "$name" ]] && die "unexpected argument: $1"; name="$1"; shift ;;
  esac
done

[[ -n "$name" ]] || die "usage: scripts/new-worktree.sh <name> [options]"
[[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "name must be lowercase letters, digits and dashes"

# In a linked worktree, --from HEAD and server/.env would resolve inconsistently.
[[ "$(git -C "$repo_root" rev-parse --absolute-git-dir)" == "$git_common_dir" ]] ||
  die "this is a worktree, and scripts/new-worktree.sh only works in the main checkout ($main_root). Report this rather than working around it."

branch="${branch:-$name}"
worktree_dir="$(dirname "$main_root")/alliance-$name"
db_name="alliance_${name//-/_}"
test_db_name="${db_name}_test"

[[ -e "$worktree_dir" ]] && die "$worktree_dir already exists"

any_port_in_use() {
  local status=0
  bun "$repo_root/scripts/port-probe.ts" "$@" || status=$?
  case "$status" in
    0) return 0 ;;
    1) return 1 ;;
    *) die "scripts/port-probe.ts failed (exit $status) probing ports: $*" ;;
  esac
}

# ports.json is authoritative because the dev servers resolve through it.
# .worktree/env supports older worktrees. Reading only env would miss a worktree
# whose env was edited or never written, and port probing cannot see an idle one.
#
# Process substitution keeps claimed in this shell after the loop finishes.
collect_claimed_slots() {
  local dir claimed="" found
  while IFS= read -r dir; do
    found=""
    if [[ -f "$dir/.worktree/ports.json" ]]; then
      # A malformed file makes ports.ts throw, which must not read as unclaimed.
      found="$( (cd "$dir" && bun "$repo_root/scripts/ports.ts") | sed -n 's/^SLOT=//p' )" ||
        die "cannot read $dir/.worktree/ports.json, so its slot cannot be told apart from a free one — fix or remove that worktree"
    elif [[ -f "$dir/.worktree/env" ]]; then
      found="$(sed -n 's/^export ALLIANCE_PORT_SLOT=//p' "$dir/.worktree/env")"
    fi
    if [[ -n "$found" && "$found" != 0 ]]; then
      claimed+=" $found"
    fi
  done < <(git -C "$main_root" worktree list --porcelain | sed -n 's/^worktree //p')
  echo "$claimed"
}

# `die` inside the command substitution exits only that subshell, so `set -e`
# catching the failed assignment is what stops the run.
claimed_slots="$(collect_claimed_slots)"

slot_claimed() {
  [[ " $claimed_slots " == *" $1 "* ]]
}

slot_free() {
  local candidate="$1" offset=$(( $1 * PORT_SLOT_STRIDE ))
  slot_claimed "$candidate" && return 1
  any_port_in_use \
    $(( BASE_SERVER_PORT + offset )) \
    $(( BASE_FRONTEND_PORT + offset )) \
    $(( BASE_ADMIN_PORT + offset )) \
    $(( BASE_MOBILE_PORT + offset )) && return 1
  return 0
}

# The durable .worktree/ports.json claim does not exist yet, so concurrent runs
# reserve slots with an atomic mkdir under the shared git directory.
lock_root="$git_common_dir/alliance-slot-locks"
mkdir -p "$lock_root"

held_lock=""
held_reaper=""

release_lock() {
  [[ -n "$held_lock" ]] && rm -rf "$held_lock"
  [[ -n "$held_reaper" ]] && rmdir "$held_reaper" 2>/dev/null
  held_lock=""
  held_reaper=""
}

# A signal trap that only released the lock would let bash resume the run
# afterwards, unlocked, while another run takes the slot. Exiting from the
# signal traps still runs the EXIT trap, so the lock is released exactly once.
trap release_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

claim_slot() {
  # Under set -u, a combined local declaration would read candidate too early.
  local candidate="$1"
  local dir="$lock_root/$candidate"

  mkdir "$dir" 2>/dev/null || return 1
  echo $$ > "$dir/pid"
  held_lock="$dir"
  return 0
}

# A SIGKILLed run leaves its lock behind. Without reaping it the slot would drop
# out of selection with nothing said, until enough had leaked that every slot
# looked taken.
#
# Reaping needs its own mutex: two runs that both cleared one stale lock would
# both go on to claim the slot, which is the collision the lock exists to
# prevent. An unreadable pid counts as live — claim_slot writes it a moment
# after mkdir, and reaping inside that window would hand out a held slot.
reap_stale_lock() {
  local candidate="$1"
  local dir="$lock_root/$candidate"
  local reaper="$lock_root/$candidate.reaping"
  local owner status=1

  mkdir "$reaper" 2>/dev/null || return 1
  held_reaper="$reaper"

  owner="$(cat "$dir/pid" 2>/dev/null || true)"
  if [[ -n "$owner" ]] && ! kill -0 "$owner" 2>/dev/null; then
    echo "note: clearing stale lock on slot $candidate (holder $owner is gone)" >&2
    rm -rf "$dir"
    status=0
  fi

  rmdir "$reaper"
  held_reaper=""
  return "$status"
}

take_slot() {
  claim_slot "$1" && return 0
  reap_stale_lock "$1" || return 1
  claim_slot "$1"
}

if [[ -n "$slot" ]]; then
  [[ "$slot" =~ ^[0-9]+$ ]] && (( slot >= 1 && slot <= MAX_SLOT )) || die "--slot must be 1-$MAX_SLOT"
  # --force may override a settled claim, but never an in-progress creation.
  take_slot "$slot" ||
    die "slot $slot is locked — another scripts/new-worktree.sh (pid $(cat "$lock_root/$slot/pid" 2>/dev/null || echo unknown)) is creating it right now"
  if (( ! force )) && ! slot_free "$slot"; then
    die "slot $slot is already claimed by another worktree or its ports are in use (--force to override)"
  fi
else
  for candidate in $(seq 1 "$MAX_SLOT"); do
    take_slot "$candidate" || continue
    if slot_free "$candidate"; then slot="$candidate"; break; fi
    release_lock
  done
  [[ -n "$slot" ]] || die "no free port slot (1-$MAX_SLOT) available"
fi

offset=$(( slot * PORT_SLOT_STRIDE ))
server_port=$(( BASE_SERVER_PORT + offset ))
frontend_port=$(( BASE_FRONTEND_PORT + offset ))
admin_port=$(( BASE_ADMIN_PORT + offset ))
mobile_port=$(( BASE_MOBILE_PORT + offset ))

source_env="$main_root/server/.env"
[[ -f "$source_env" ]] || die "$source_env not found — copy server/.env.example first"

db_host="$(env_value "$source_env" DB_HOST)"
db_port="$(env_value "$source_env" DB_PORT)"
db_user="$(env_value "$source_env" DB_USERNAME)"
db_password="$(env_value "$source_env" DB_PASSWORD)"
source_db="$(env_value "$source_env" DB_NAME)"

# DB_PASSWORD stays optional — a local cluster may use trust or peer auth.
[[ -n "$db_host" ]] || die "DB_HOST not set in $source_env"
[[ -n "$db_port" ]] || die "DB_PORT not set in $source_env"
[[ -n "$db_user" ]] || die "DB_USERNAME not set in $source_env"
[[ -n "$source_db" ]] || die "DB_NAME not set in $source_env"
[[ "$db_name" != "$source_db" && "$test_db_name" != "$source_db" ]] ||
  die "database name $db_name/$test_db_name collides with the main checkout's DB_NAME — pick another worktree name"

for tool in psql createdb dropdb pg_dump; do
  command -v "$tool" >/dev/null || die "$tool not found — install the postgres client tools"
done

if [[ -n "$db_password" ]]; then export PGPASSWORD="$db_password"; fi
psql_args=(-h "$db_host" -p "$db_port" -U "$db_user")
psql "${psql_args[@]}" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1 ||
  die "cannot reach postgres at $db_host:$db_port as $db_user (credentials from $source_env)"

# Create databases before the worktree so a database failure leaves no checkout
# that rm-worktree.sh cannot identify.
existing_db="$(psql "${psql_args[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'")"
if [[ "$existing_db" == "1" ]]; then
  echo "==> database $db_name already exists, reusing"
else
  echo "==> copying database $source_db -> $db_name"
  if ! createdb "${psql_args[@]}" -T "$source_db" "$db_name" 2>/dev/null; then
    echo "    template copy failed (source database in use), falling back to dump/restore"
    createdb "${psql_args[@]}" "$db_name"
    # psql can exit 0 after SQL errors unless ON_ERROR_STOP is set.
    if ! pg_dump "${psql_args[@]}" -d "$source_db" |
      psql "${psql_args[@]}" -q -v ON_ERROR_STOP=1 --single-transaction -d "$db_name" >/dev/null; then
      dropdb --if-exists "${psql_args[@]}" "$db_name"
      die "restoring $source_db into $db_name failed"
    fi
  fi
fi

# The test database never copies dev data; the e2e suite owns its schema through
# dropSchema and synchronize.
existing_test_db="$(psql "${psql_args[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$test_db_name'")"
if [[ "$existing_test_db" == "1" ]]; then
  echo "==> test database $test_db_name already exists, reusing"
else
  echo "==> creating test database $test_db_name"
  createdb "${psql_args[@]}" "$test_db_name"
fi

echo "==> creating worktree $worktree_dir (slot $slot)"
if git -C "$main_root" show-ref --verify --quiet "refs/heads/$branch"; then
  git -C "$main_root" worktree add "$worktree_dir" "$branch"
else
  git -C "$main_root" worktree add -b "$branch" "$worktree_dir" "$from"
fi

echo "==> copying local (untracked) config"

# Drop copied port overrides that would point back to the source checkout. grep
# exits 1 when every line is removed. Every file below is dotenv, so they all
# go through this.
strip_port_overrides() {
  grep -Ev '^[[:space:]]*(export[[:space:]]+)?(SERVER_PORT|PORT|FRONTEND_PORT|ADMIN_PORT|MOBILE_PORT|ALLIANCE_DEV_[A-Z_]+_URL|EXPO_PUBLIC_ALLIANCE_API_PORT)=' "$1" || true
}

for f in server/.env apps/frontend/.env.local apps/admin/.env.local apps/mobile/.env; do
  if [[ -f "$main_root/$f" ]]; then
    mkdir -p "$worktree_dir/$(dirname "$f")"
    strip_port_overrides "$main_root/$f" > "$worktree_dir/$f"
    echo "    $f"
  fi
done

echo "==> writing .worktree/"
mkdir -p "$worktree_dir/.worktree"

# Vite and the server read this even when started outside the root scripts.
cat > "$worktree_dir/.worktree/ports.json" <<JSON
{
  "name": "$name",
  "slot": $slot,
  "server": $server_port,
  "frontend": $frontend_port,
  "admin": $admin_port,
  "mobile": $mobile_port,
  "database": "$db_name",
  "testDatabase": "$test_db_name"
}
JSON

cat > "$worktree_dir/.worktree/env" <<ENV
# Generated by scripts/new-worktree.sh alongside ports.json — regenerate both
# together, or just recreate the worktree. Sourced by scripts/with-env.sh, which
# every root dev script goes through.
export ALLIANCE_WORKTREE=$name
export ALLIANCE_PORT_SLOT=$slot


# Do not export DB_NAME. It outranks server/.env.test and could make the e2e
# suite's dropSchema erase the dev database. server/.env supplies DB_NAME.
export ALLIANCE_DB_NAME=$db_name

# Only the e2e datasource reads TEST_DB_NAME.
export TEST_DB_NAME=$test_db_name

export APP_URL=http://localhost:$frontend_port
export ADMIN_URL=http://localhost:$admin_port
ENV

render_template() {
  local template="$1" content
  content="$(cat "$template")"
  content="${content//\{\{NAME\}\}/$name}"
  content="${content//\{\{BRANCH\}\}/$branch}"
  content="${content//\{\{SERVER_PORT\}\}/$server_port}"
  content="${content//\{\{FRONTEND_PORT\}\}/$frontend_port}"
  content="${content//\{\{ADMIN_PORT\}\}/$admin_port}"
  content="${content//\{\{MOBILE_PORT\}\}/$mobile_port}"
  content="${content//\{\{DB_NAME\}\}/$db_name}"
  content="${content//\{\{TEST_DB_NAME\}\}/$test_db_name}"

  if [[ "$content" == *"{{"* ]]; then
    die "unsubstituted placeholder left in $template: $(grep -o '{{[A-Z_]*}}' <<<"$content" | sort -u | tr '\n' ' ')"
  fi

  printf '%s\n' "$content"
}

agents_template="$repo_root/scripts/templates/worktree-AGENTS.md"
[[ -f "$agents_template" ]] || die "$agents_template not found"
render_template "$agents_template" > "$worktree_dir/.worktree/AGENTS.md"

echo "==> applying worktree overrides to server/.env"

# The TypeORM CLI reads this file without with-env.sh. Replace duplicate keys so
# no parser can select a stale database value.
set_env_key() {
  local key="$1" val="$2" file="$3"
  awk -v key="$key" -v val="$val" '
    BEGIN { re = "^(export[ \t]+)?" key "=" }
    $0 ~ re { if (!seen) { print key "=" val; seen = 1 } next }
    { print }
    END { if (!seen) print key "=" val }
  ' "$file" > "$file.tmp"
  cat "$file.tmp" > "$file"
  rm -f "$file.tmp"
}

# No port key: a worktree binds what .worktree/ports.json says, so one here
# would be a second source of truth that assertWorktreePorts then has to reject.
worktree_env="$worktree_dir/server/.env"
set_env_key DB_NAME "$db_name" "$worktree_env"
# .env.test does not overwrite this, so direct e2e runs stay isolated.
set_env_key TEST_DB_NAME "$test_db_name" "$worktree_env"
set_env_key APP_URL "http://localhost:$frontend_port" "$worktree_env"
set_env_key ADMIN_URL "http://localhost:$admin_port" "$worktree_env"

echo "==> bun install"
(cd "$worktree_dir" && bun install)

echo
echo "worktree ready: $worktree_dir"
echo "  server    http://localhost:$server_port"
echo "  frontend  http://localhost:$frontend_port"
echo "  admin     http://localhost:$admin_port"
echo "  metro     http://localhost:$mobile_port"
echo "  database  $db_name"
echo "  test db   $test_db_name"

#!/usr/bin/env bash
# Creates a git worktree that runs completely independently of the main
# checkout: its own server/frontend/admin/metro ports and its own local
# database.
#
# Only works in the main checkout. Inside a worktree it exits.
#
# Usage: scripts/new-worktree.sh <name> [options]
#
#   --branch <branch>  branch to create or check out (default: <name>). A branch
#                      that already exists is kept when the worktree is removed.
#   --from <ref>       base a new branch on <ref> (default: HEAD)
#
# Ports come from the lowest free slot.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/lib/env-value.sh
source "$repo_root/scripts/lib/env-value.sh"
# shellcheck source=scripts/lib/worktree-paths.sh
source "$repo_root/scripts/lib/worktree-paths.sh"
# shellcheck source=scripts/lib/worktree-lock.sh
source "$repo_root/scripts/lib/worktree-lock.sh"
# shellcheck source=scripts/lib/worktree-process.sh
source "$repo_root/scripts/lib/worktree-process.sh"
# shellcheck source=scripts/lib/worktree-registry.sh
source "$repo_root/scripts/lib/worktree-registry.sh"
# shellcheck source=scripts/lib/worktree-db.sh
source "$repo_root/scripts/lib/worktree-db.sh"

# Assign first: `eval "$(...)"` succeeds on empty output, so a failure here would
# surface further down as an unbound variable naming none of this.
bases="$(bun "$repo_root/scripts/ports.ts" --base)" ||
  die "scripts/ports.ts --base failed, so the port bases for a slot are unknown"
eval "$bases"
MAX_SLOT="$MAX_PORT_SLOT"

usage() {
  awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0"
}

name=""
branch=""
from="HEAD"
slot=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) branch="${2:-}"; shift 2 ;;
    --from) from="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [[ -n "$name" ]] && die "unexpected argument: $1"; name="$1"; shift ;;
  esac
done

[[ -n "$name" ]] || die "usage: scripts/new-worktree.sh <name> [options]"
valid_name "$name" || die "name must be lowercase letters, digits and dashes"

# In a linked worktree, --from HEAD and server/.env would resolve inconsistently.
[[ "$(git -C "$repo_root" rev-parse --absolute-git-dir)" == "$git_common_dir" ]] ||
  die "this is a worktree, and scripts/new-worktree.sh only works in the main checkout ($main_root). Report this rather than working around it."
parent=main

git -C "$main_root" rev-parse --verify --quiet "$from^{commit}" >/dev/null ||
  die "--from $from is not a commit"

branch="${branch:-$name}"
valid_branch "$branch" || die "invalid branch name: $branch"
worktree_dir="$(worktree_dir_for "$name")"
db_name="$(db_name_for "$name")"
test_db_name="${db_name}_test"

[[ "$worktree_dir" != "$main_root" ]] || die "$worktree_dir is the main checkout — pick another worktree name"

load_main_db_settings
[[ "$db_name" != "$source_db" && "$test_db_name" != "$source_db" ]] ||
  die "database name $db_name/$test_db_name collides with the main checkout's DB_NAME — pick another worktree name"

any_port_in_use() {
  local status=0
  bun "$repo_root/scripts/port-probe.ts" "$@" || status=$?
  case "$status" in
    0) return 0 ;;
    1) return 1 ;;
    *) die "scripts/port-probe.ts failed (exit $status) probing ports: $*" ;;
  esac
}

# Worktrees created before records claim their slot only through ports.json, or
# .worktree/env in older ones. Port probing cannot see an idle one.
#
# Process substitution keeps claimed in this shell after the loop finishes.
collect_unrecorded_slots() {
  local dir claimed="" found
  while IFS= read -r dir; do
    found=""
    [[ -f "$(instance_file "$dir")" ]] && continue
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

ports_in_use() {
  local offset=$(( $1 * PORT_SLOT_STRIDE ))
  any_port_in_use \
    $(( BASE_SERVER_PORT + offset )) \
    $(( BASE_FRONTEND_PORT + offset )) \
    $(( BASE_ADMIN_PORT + offset )) \
    $(( BASE_MOBILE_PORT + offset ))
}

id=""
created=""

on_exit() {
  if [[ -n "$id" && -z "$created" ]]; then
    echo "error: $name was not finished. Its record keeps what it created so far; remove that with 'scripts/rm-worktree.sh $name'." >&2
  fi
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$instances"
while :; do
  acquire_lock "$registry_lock" "the worktree registry" 8
  previous="$(records_with name "$name")"
  removing_stamp="$(readlink "$instances/$previous/removing" 2>/dev/null || true)"
  if [[ -n "$previous" && -n "$removing_stamp" ]] && stamp_alive "$removing_stamp"; then
    release_lock 8
    echo "==> waiting for pid ${removing_stamp%% *} to finish removing the previous $name" >&2
    while [[ -d "$instances/$previous" ]] && stamp_alive "$removing_stamp"; do sleep 0.2; done
    continue
  fi
  break
done
sweep_registry_leftovers

[[ -z "$previous" ]] ||
  die "a worktree named $name is already recorded, and someone may be using it — choose another name. Only if your own run stopped while creating or removing $name, 'scripts/rm-worktree.sh $name' removes what it left"

# A worktree from before records owns its databases without a record, so its
# directory is checked first.
[[ ! -e "$worktree_dir" ]] || die "$worktree_dir already exists"

for db in "$db_name" "$test_db_name"; do
  [[ -z "$(records_with db "$db")$(records_with test_db "$db")" ]] ||
    die "database $db belongs to another worktree — pick another name"
  ! db_exists "$db" ||
    die "database $db already exists and no worktree records it — pick another name, or drop it if nothing uses it"
done

# A holder may have switched away from its branch, so being checked out is not
# the only claim on it.
branch_holder="$(records_with branch "$branch" | head -n 1)"
[[ -z "$branch_holder" ]] || die "branch $branch belongs to worktree $(record_field "$branch_holder" name)"
if git -C "$main_root" show-ref --verify --quiet "refs/heads/$branch"; then
  branch_created=0
  ! branch_checked_out "$branch" ||
    die "branch $branch is already checked out in another worktree"
else
  branch_created=1
fi

recorded_slots=" $(record_fields slot | tr '\n' ' ') "
# `die` inside the command substitution exits only that subshell, so `set -e`
# catching the failed assignment is what stops the run.
unrecorded_slots=" $(collect_unrecorded_slots) "

for candidate in $(seq 1 "$MAX_SLOT"); do
  [[ "$recorded_slots $unrecorded_slots" == *" $candidate "* ]] && continue
  ports_in_use "$candidate" && continue
  slot="$candidate"
  break
done
[[ -n "$slot" ]] || die "no free port slot (1-$MAX_SLOT) available"

new_id="$(bun -e 'console.log(Bun.randomUUIDv7())')"
staging="$instances/.new-$new_id"
mkdir "$staging"
# The lock is held before the record is visible, so removal waits for this
# creation from the moment it can see it.
acquire_lock "$staging/lock" "worktree $name" 9
cat > "$staging/record" <<RECORD
name=$name
parent=$parent
dir=$worktree_dir
db=$db_name
test_db=$test_db_name
branch=$branch
branch_created=$branch_created
slot=$slot
RECORD
mv "$staging" "$instances/$new_id"
id="$new_id"
release_lock 8

offset=$(( slot * PORT_SLOT_STRIDE ))
server_port=$(( BASE_SERVER_PORT + offset ))
frontend_port=$(( BASE_FRONTEND_PORT + offset ))
admin_port=$(( BASE_ADMIN_PORT + offset ))
mobile_port=$(( BASE_MOBILE_PORT + offset ))
owner_tag="$(db_owner_tag "$id")"

staging_db="$(staging_db_for "$id")"

# A database exists under its real name only once tagged, so a stop at any point
# leaves only databases removal can tell are this record's. RENAME fails on a
# name someone else took after the check above.
run_sql() { psql -X "${psql_args[@]}" -d postgres -q -v ON_ERROR_STOP=1 -c "$1"; }
tag_db() { run_sql "COMMENT ON DATABASE \"$1\" IS '$owner_tag'"; }
publish_db() { run_sql "ALTER DATABASE \"$1\" RENAME TO \"$2\""; }

echo "==> copying database $source_db -> $db_name"
if createdb "${psql_args[@]}" -T "$source_db" "$staging_db" 2>/dev/null; then
  tag_db "$staging_db"
else
  echo "    template copy failed (source database in use), falling back to dump/restore"
  createdb "${psql_args[@]}" "$staging_db"
  tag_db "$staging_db"
  # psql can exit 0 after SQL errors unless ON_ERROR_STOP is set.
  if ! pg_dump "${psql_args[@]}" -d "$source_db" |
    psql "${psql_args[@]}" -q -v ON_ERROR_STOP=1 --single-transaction -d "$staging_db" >/dev/null; then
    die "restoring $source_db into $db_name failed"
  fi
fi
publish_db "$staging_db" "$db_name"

# The test database never copies dev data; the e2e suite owns its schema through
# dropSchema and synchronize.
echo "==> creating test database $test_db_name"
createdb "${psql_args[@]}" "${staging_db}_test"
tag_db "${staging_db}_test"
publish_db "${staging_db}_test" "$test_db_name"

echo "==> creating worktree $worktree_dir (slot $slot)"
# A stop between branching and recording it leaves the branch at branch_from,
# where removal can tell it from one that has commits of its own.
if (( branch_created )); then
  # --from can move while the database copies, so it resolves again here.
  from_rev="$(git -C "$main_root" rev-parse --verify --quiet "$from^{commit}")" ||
    die "--from $from is not a commit"
  set_record_field "$id" branch_from "$from_rev"
  # A branch someone else made since the claim is theirs, so the record stops
  # pointing removal at it. Branching from --from itself lets
  # branch.autoSetupMerge choose the upstream.
  git -C "$main_root" branch "$branch" "$from" || {
    set_record_field "$id" branch_from ""
    exit 1
  }
  set_record_field "$id" branch_added 1
fi
# mkdir fails on a path someone else took after the check above, so dir_added
# claims only a tree this run makes.
mkdir "$worktree_dir" || die "could not create $worktree_dir"
set_record_field "$id" dir_added 1
# Children inherit the lock's descriptor, and a daemon one leaves running, such as
# git's fsmonitor, would hold the lock after this run exits. The tree holds only
# its .git until the instance file is written, so removal accepts a populated
# tree only by its instance file.
git -C "$main_root" worktree add --no-checkout "$worktree_dir" "$branch" 9>&- || {
  rmdir "$worktree_dir" 2>/dev/null && set_record_field "$id" dir_added ""
  exit 1
}
echo "$id" > "$(instance_file "$worktree_dir")"
# The instance file claims the tree from here, so a worktree made by hand after
# this one is deleted is not taken for it.
set_record_field "$id" dir_added ""
git -C "$worktree_dir" checkout -q -f 9>&-

mkdir -p "$worktree_dir/.worktree"

echo "==> copying local (untracked) config"

# Drop copied port overrides that would point back to the source checkout. grep
# exits 1 when every line is removed. Every file below is dotenv, so they all
# go through this.
strip_port_overrides() {
  grep -Ev '^[[:space:]]*(export[[:space:]]+)?(SERVER_PORT|PORT|FRONTEND_PORT|ADMIN_PORT|MOBILE_PORT|ALLIANCE_DEV_[A-Z_]+_URL|EXPO_PUBLIC_ALLIANCE_API_PORT)=' "$1" || true
}

for f in .env.devtools server/.env apps/frontend/.env.local apps/admin/.env.local apps/mobile/.env; do
  if [[ -f "$main_root/$f" ]]; then
    mkdir -p "$worktree_dir/$(dirname "$f")"
    strip_port_overrides "$main_root/$f" > "$worktree_dir/$f"
    echo "    $f"
  fi
done

echo "==> writing .worktree/"

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
(cd "$worktree_dir" && bun install 9>&-)

created=1

echo
echo "worktree ready: $worktree_dir"
echo "  server    http://localhost:$server_port"
echo "  frontend  http://localhost:$frontend_port"
echo "  admin     http://localhost:$admin_port"
echo "  metro     http://localhost:$mobile_port"
echo "  database  $db_name"
echo "  test db   $test_db_name"

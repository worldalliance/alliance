#!/usr/bin/env bash
# Removes a worktree created by scripts/new-worktree.sh and drops its database.
# Only works from outside the worktree being removed.
#
# Usage: scripts/rm-worktree.sh <name>
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/lib/env-value.sh
source "$repo_root/scripts/lib/env-value.sh"

main_root="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir)"
main_root="$(cd "$(dirname "$main_root")" && pwd)"

die() { echo "error: $*" >&2; exit 1; }

usage() {
  awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0"
}

name=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [[ -n "$name" ]] && die "unexpected argument: $1"; name="$1"; shift ;;
  esac
done

[[ -n "$name" ]] || die "usage: scripts/rm-worktree.sh <name>"
[[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "name must be lowercase letters, digits and dashes"

worktree_dir="$(dirname "$main_root")/alliance-$name"
[[ -d "$worktree_dir" ]] || die "$worktree_dir not found"
[[ "$worktree_dir" == "$main_root" ]] && die "refusing to remove the main checkout"

[[ "$PWD" != "$worktree_dir" && "$PWD" != "$worktree_dir"/* ]] ||
  die "$worktree_dir is the checkout you are working in, so removing it would delete the ground under you. Report this rather than working around it."

worktree_ports="$worktree_dir/.worktree/ports.json"
worktree_env="$worktree_dir/.worktree/env"

# Resolve ports.json with the same validated parser as the dev servers. The
# dotenv fallback supports worktrees created before ports.json existed.
port_field() { (cd "$worktree_dir" && bun "$repo_root/scripts/ports.ts" "$1"); }

if [[ -f "$worktree_ports" ]]; then
  db_name="$(port_field database)"
  test_db_name="$(port_field test-database)"
elif [[ -f "$worktree_env" ]]; then
  db_name="$(env_value "$worktree_env" ALLIANCE_DB_NAME)"
  test_db_name="$(env_value "$worktree_env" TEST_DB_NAME)"
else
  die "$worktree_dir has neither .worktree/ports.json nor .worktree/env, so its databases cannot be named — drop them by hand, then 'git worktree remove --force $worktree_dir'"
fi

[[ -n "$db_name" || -n "$test_db_name" ]] ||
  die "neither .worktree/ports.json nor .worktree/env names a database for $worktree_dir — drop them by hand, then 'git worktree remove --force $worktree_dir'"

branch="$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD)"

# --force is required for generated ignored files, so reproduce git's safety
# check before using it.
if [[ -n "$(git -C "$worktree_dir" status --porcelain)" ]]; then
  git -C "$worktree_dir" status --short >&2
  die "$worktree_dir has uncommitted changes or untracked files — commit or remove them, or remove the worktree by hand with 'git worktree remove --force'"
fi

source_env="$main_root/server/.env"

# Resolve the main database before removing the metadata needed for recovery.
[[ -f "$source_env" ]] ||
  die "$source_env not found, so $db_name cannot be told apart from the main checkout's database — remove the worktree by hand with 'git worktree remove --force'"

main_db="$(env_value "$source_env" DB_NAME)"
db_host="$(env_value "$source_env" DB_HOST)"
db_port="$(env_value "$source_env" DB_PORT)"
db_user="$(env_value "$source_env" DB_USERNAME)"
db_password="$(env_value "$source_env" DB_PASSWORD)"

# DB_PASSWORD stays optional — a local cluster may use trust or peer auth.
[[ -n "$main_db" ]] || die "DB_NAME not set in $source_env"
[[ -n "$db_host" ]] || die "DB_HOST not set in $source_env"
[[ -n "$db_port" ]] || die "DB_PORT not set in $source_env"
[[ -n "$db_user" ]] || die "DB_USERNAME not set in $source_env"

# Drop databases before their identifying metadata. Recheck hand-editable names
# against the main database at the destructive call.
if [[ -n "$db_password" ]]; then export PGPASSWORD="$db_password"; fi
for db in "$db_name" "$test_db_name"; do
  [[ -n "$db" ]] || continue
  if [[ "$db" == "$main_db" ]]; then
    echo "==> keeping $db, which is the main checkout's database"
    continue
  fi
  echo "==> dropping database $db"
  dropdb --if-exists --force -h "$db_host" -p "$db_port" -U "$db_user" "$db"
done

echo "==> removing worktree $worktree_dir (branch $branch)"
git -C "$main_root" worktree remove --force "$worktree_dir"

if git -C "$main_root" show-ref --verify --quiet "refs/heads/$branch"; then
  if git -C "$main_root" branch -d "$branch" 2>/dev/null; then
    echo "==> deleted branch $branch"
  else
    echo "==> branch $branch has unmerged commits, keeping it"
  fi
fi

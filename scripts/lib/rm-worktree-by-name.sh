#!/usr/bin/env bash
# Removes a worktree by name, finding its databases in its own .worktree/.
# Source after worktree-db.sh.

remove_worktree_by_name() {
  local name="$1" worktree_dir worktree_ports worktree_env db_name test_db_name branch db
  worktree_dir="$(worktree_dir_for "$name")"
  [[ -d "$worktree_dir" ]] || die "$worktree_dir not found"
  [[ "$worktree_dir" == "$main_root" ]] && die "refusing to remove the main checkout"

  is_our_worktree "$worktree_dir" ||
    die "$worktree_dir is not a worktree of $main_root, so it will not be removed"

  refuse_unremovable "$worktree_dir"

  worktree_ports="$worktree_dir/.worktree/ports.json"
  worktree_env="$worktree_dir/.worktree/env"

  # Resolve ports.json with the same validated parser as the dev servers. The
  # dotenv fallback supports worktrees created before ports.json existed.
  if [[ -f "$worktree_ports" ]]; then
    db_name="$(cd "$worktree_dir" && bun "$repo_root/scripts/ports.ts" database)"
    test_db_name="$(cd "$worktree_dir" && bun "$repo_root/scripts/ports.ts" test-database)"
  elif [[ -f "$worktree_env" ]]; then
    db_name="$(env_value "$worktree_env" ALLIANCE_DB_NAME)"
    test_db_name="$(env_value "$worktree_env" TEST_DB_NAME)"
  else
    die "$worktree_dir has neither .worktree/ports.json nor .worktree/env, so its databases cannot be named — drop them by hand, then 'rm -rf $worktree_dir && git -C $main_root worktree prune'"
  fi

  [[ -n "$db_name" || -n "$test_db_name" ]] ||
    die "neither .worktree/ports.json nor .worktree/env names a database for $worktree_dir — drop them by hand, then 'rm -rf $worktree_dir && git -C $main_root worktree prune'"

  # A worktree left half-removed by an earlier run has a dangling .git pointer,
  # so HEAD no longer resolves.
  branch="$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

  [[ -f "$main_root/server/.env" ]] ||
    die "$main_root/server/.env not found, so $db_name cannot be told apart from the main checkout's database — remove the worktree by hand with 'rm -rf $worktree_dir && git -C $main_root worktree prune'"
  load_main_db_settings

  # Drop databases before their identifying metadata. Recheck hand-editable
  # names against the main database at the destructive call.
  for db in "$db_name" "$test_db_name"; do
    [[ -n "$db" ]] || continue
    if [[ "$db" == "$source_db" ]]; then
      echo "==> keeping $db, which is the main checkout's database"
      continue
    fi
    echo "==> dropping database $db"
    dropdb --if-exists --force "${psql_args[@]}" "$db"
  done

  echo "==> removing worktree $worktree_dir${branch:+ (branch $branch)}"
  # 'git worktree remove --force' has failed partway through a node_modules this
  # size and deregistered the worktree anyway. If rm -rf fails, set -e stops
  # here with the worktree still registered.
  rm -rf "$worktree_dir"
  git -C "$main_root" worktree prune

  if [[ -n "$branch" ]] && git -C "$main_root" show-ref --verify --quiet "refs/heads/$branch"; then
    if git -C "$main_root" branch -d "$branch" 2>/dev/null; then
      echo "==> deleted branch $branch"
    else
      echo "==> branch $branch has unmerged commits, keeping it"
    fi
  fi
}

#!/usr/bin/env bash
# Paths and checkout checks shared by new-worktree.sh and rm-worktree.sh. Set
# repo_root before sourcing.

die() { echo "error: $*" >&2; exit 1; }

git_common_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir)" ||
  die "cannot find the Git directory of $repo_root"
main_root="$(cd "$(dirname "$git_common_dir")" && pwd)"
worktree_root="$(dirname "$main_root")"

valid_name() { [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]]; }

worktree_dir_for() { echo "$worktree_root/alliance-$1"; }

is_current_checkout() {
  local here
  here="$(pwd -P)" ||
    die "cannot resolve the current directory, so it cannot be told apart from $1"
  [[ "$here" == "$1" || "$here" == "$1"/* ]]
}

# A half-removed worktree is already deregistered, so the .git pointer, not
# 'git worktree list', is what says this tree is ours for rm -rf to delete.
is_our_worktree() {
  [[ "$(cat "$1/.git" 2>/dev/null)" == "gitdir: $git_common_dir/worktrees/"* ]]
}

# rm -rf does not honour the lock that 'git worktree remove' refuses to cross.
worktree_locked() {
  local git_dir
  git_dir="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null || true)"
  [[ -n "$git_dir" && -f "$git_dir/locked" ]]
}

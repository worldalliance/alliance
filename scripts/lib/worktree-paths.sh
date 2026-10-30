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

refuse_current_checkout() {
  ! is_current_checkout "$1" ||
    die "$1 is the checkout you are working in, and this removal would delete it from under you. Report this rather than working around it."
}

# Not grep -q: exiting on the first match can SIGPIPE git, and pipefail would
# then report a match as a miss.
branch_checked_out() {
  git -C "$main_root" worktree list --porcelain | grep -xF "branch refs/heads/$1" >/dev/null
}

refuse_unremovable() {
  refuse_current_checkout "$1"
  ! worktree_locked "$1" ||
    die "$1 is locked — 'git -C $main_root worktree unlock $1' first if you really mean to remove it"
}

# A half-removed worktree is already deregistered, so the .git pointer, not
# 'git worktree list', is what says this tree is ours for rm -rf to delete.
is_our_worktree() { [[ "$(admin_dir_of "$1")" == "$git_common_dir/worktrees/"* ]]; }

# The Git admin directory a checkout's .git file names, as an absolute path.
# worktree.useRelativePaths writes it relative to the checkout. Its leading ../
# segments resolve lexically, since a half-removed worktree's admin directory and
# its parent may be gone.
admin_dir_of() {
  local git_dir dir
  git_dir="$(sed -n 's/^gitdir: //p' "$1/.git" 2>/dev/null || true)"
  if [[ -n "$git_dir" && "$git_dir" != /* ]]; then
    dir="$(cd "$1" && pwd -P)"
    while [[ "$git_dir" == ../* ]]; do
      dir="$(dirname "$dir")"
      git_dir="${git_dir#../}"
    done
    git_dir="$dir/$git_dir"
  fi
  echo "$git_dir"
}

# rm -rf does not honour the lock that 'git worktree remove' refuses to cross.
worktree_locked() {
  local git_dir
  git_dir="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null || true)"
  [[ -n "$git_dir" && -f "$git_dir/locked" ]]
}

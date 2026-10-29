#!/usr/bin/env bash
# Removes a worktree created by scripts/new-worktree.sh and drops its database.
# Only works from outside the worktree being removed.
#
# Usage: scripts/rm-worktree.sh <name>
#        scripts/rm-worktree.sh --list
#
# --list prints the removable worktrees, one 'name<tab>branch' line each. It is
# what backs <name> tab-completing in zsh, once ~/.zshrc puts scripts/completions
# on fpath ahead of compinit:
#
#   fpath=("${path_to_repo}/scripts/completions" $fpath)
#   autoload -Uz compinit && compinit
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/lib/env-value.sh
source "$repo_root/scripts/lib/env-value.sh"
# shellcheck source=scripts/lib/worktree-paths.sh
source "$repo_root/scripts/lib/worktree-paths.sh"
# shellcheck source=scripts/lib/worktree-db.sh
source "$repo_root/scripts/lib/worktree-db.sh"
# shellcheck source=scripts/lib/rm-worktree-by-name.sh
source "$repo_root/scripts/lib/rm-worktree-by-name.sh"

usage() {
  awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0"
}

# HEAD does not resolve through a half-removed worktree's dangling .git pointer.
head_label() {
  git -C "$1" symbolic-ref --short -q HEAD 2>/dev/null ||
    git -C "$1" rev-parse --short HEAD 2>/dev/null ||
    echo half-removed
}

# Every worktree this script would accept a name for, so the completion offers
# exactly those and nothing else.
list_worktrees() {
  local dir dir_name
  for dir in "$worktree_root"/alliance-*/; do
    dir="${dir%/}"
    [[ -d "$dir" ]] || continue
    dir_name="${dir##*/alliance-}"
    valid_name "$dir_name" || continue
    is_our_worktree "$dir" || continue
    is_current_checkout "$dir" && continue
    printf '%s\t%s\n' "$dir_name" "$(head_label "$dir")"
  done
}

name=""
list=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --list) list=1; shift ;;
    -*) die "unknown option: $1" ;;
    *) [[ -n "$name" ]] && die "unexpected argument: $1"; name="$1"; shift ;;
  esac
done

if [[ -n "$list" ]]; then
  [[ -z "$name" ]] || die "--list takes no name"
  list_worktrees
  exit 0
fi

[[ -n "$name" ]] || die "usage: scripts/rm-worktree.sh <name>"
valid_name "$name" || die "name must be lowercase letters, digits and dashes"

remove_worktree_by_name "$name"

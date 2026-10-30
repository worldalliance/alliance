#!/usr/bin/env bash
# Removes worktrees created by scripts/new-worktree.sh, with everything each
# one owns: its checkout, its databases, its port slot, and the branch the
# script created for it. A worktree's children, and theirs, go before it.
#
# Removal is destructive and asks nothing. It discards staged, unstaged,
# untracked and ignored files, local database changes, and created branches
# with any commits found nowhere else. A branch that already existed when its
# worktree was created is kept, as is a same-named branch a failed creation
# never made. Remote branches and pull requests are never touched. Stop the
# agents and dev servers running in those worktrees first.
#
# Usage: scripts/rm-worktree.sh <name>   remove <name> and its descendants
#        scripts/rm-worktree.sh --list
#
# What cannot be removed stays, along with its ancestors, and the run exits
# nonzero naming it. Independent worktrees are still removed. Rerunning the same
# command once that is resolved finishes the job.
#
# Worktrees created before records are removed by name alone, and their
# branch only when it is merged.
#
# --list prints the removable worktrees, one 'name<tab>branch' line each. It is
# what backs <name> tab-completing in zsh, once ~/.zshrc puts scripts/completions
# on fpath ahead of compinit:
#
#   fpath=("${path_to_repo}/scripts/completions" $fpath)
#   autoload -Uz compinit && compinit
set -euo pipefail

# Physical, like the worktree paths git reports that it is compared with.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

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
  local dir dir_name id lineage recorded=" "
  lineage=" $( { lineage_of "$(invoking_checkout)"; lineage_of "$repo_root"; } | tr '\n' ' ') "
  for dir in "$instances"/*/; do
    id="$(basename "$dir")"
    [[ -f "$dir/record" ]] || continue
    recorded+="$(record_field "$id" name) "
    [[ "$lineage" == *" $id "* ]] && continue
    dir="$(record_field "$id" dir)"
    is_current_checkout "$dir" && continue
    printf '%s\t%s\n' "$(record_field "$id" name)" "$(record_field "$id" branch)"
  done
  for dir in "$worktree_root"/alliance-*/; do
    dir="${dir%/}"
    [[ -d "$dir" ]] || continue
    dir_name="${dir##*/alliance-}"
    valid_name "$dir_name" || continue
    is_our_worktree "$dir" || continue
    [[ -f "$(instance_file "$dir")" ]] && continue
    [[ "$recorded" == *" $dir_name "* ]] && continue
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

[[ -n "$name" ]] || die "usage: scripts/rm-worktree.sh <name> | --list"
valid_name "$name" || die "name must be lowercase letters, digits and dashes"

remaining=""
kept_branches=""

note_remaining() {
  echo "error: $1" >&2
  remaining+="  $1"$'\n'
}

# A failed DROP leaves a database that removal has to find again, so ownership is
# checked against the database's own comment, not just the record.
drop_owned_db() {
  local id="$1" db="$2" comment tag
  [[ "$db" != "$source_db" ]] || { note_remaining "$db is the main checkout's database"; return 1; }
  comment="$(db_comment "$db")" || { note_remaining "could not query database $db"; return 1; }
  [[ "$comment" == absent ]] && return 0
  tag="${comment#comment:}"
  [[ "$comment" == "comment:$(db_owner_tag "$id")" || ("$comment" == comment: && "$db" == "$(staging_db_for "$id")"*) ]] ||
    { note_remaining "database $db is not tagged as owned by this worktree (${tag:-no tag}), so it was kept — rename it, or drop it if nothing uses it"; return 1; }
  echo "==> dropping database $db"
  dropdb --if-exists --force "${psql_args[@]}" "$db" || { note_remaining "could not drop database $db"; return 1; }
}

# dir_added claims the tree from new-worktree.sh's mkdir until its instance file
# is written, and until then the tree holds at most a .git pointing here.
owns_dir() {
  local id="$1" dir="$2" file entries
  file="$(instance_file "$dir")"
  if [[ -f "$file" ]]; then
    [[ "$(cat "$file")" == "$id" ]]
  else
    [[ "$(record_field "$id" dir_added)" == 1 ]] || return 1
    entries="$(ls -A "$dir")"
    [[ -z "$entries" ]] || { [[ "$entries" == .git ]] && is_our_worktree "$dir"; }
  fi
}

# git leaves its own lock on a tree whose 'git worktree add' was killed, and that
# tree is still claimed only through dir_added.
claimed_by_creation() { [[ "$(record_field "$1" dir_added)" == 1 && ! -f "$(instance_file "$2")" ]]; }

remove_owned_resources() {
  local id="$1" problem name dir branch from db trash added
  problem="$(record_problem "$id")"
  [[ -z "$problem" ]] || { note_remaining "record $instances/$id $problem"; return 1; }
  name="$(record_field "$id" name)"
  dir="$(record_field "$id" dir)"
  branch="$(record_field "$id" branch)"

  # A creation stopped between its mkdir and recording dir_added leaves an empty
  # directory, and rmdir fails on anything that has appeared in it since.
  if [[ "$(record_field "$id" dir_added)" != 1 && ! -f "$(instance_file "$dir")" ]]; then
    rmdir "$dir" 2>/dev/null || true
  fi
  if [[ -e "$dir" ]] && ! owns_dir "$id" "$dir"; then
    note_remaining "$dir does not belong to the recorded worktree $name, so it was kept — move it elsewhere"
    return 1
  fi

  for db in "$(staging_db_for "$id")" "$(staging_db_for "$id")_test" "$(record_field "$id" db)" "$(record_field "$id" test_db)"; do
    drop_owned_db "$id" "$db" || return 1
  done

  # Moving the tree aside frees its path at once, so a tree made there while
  # rm -rf runs, or after it fails, is never taken for what it has not reached.
  trash="$dir.removing-$id"
  if [[ -e "$dir" ]]; then
    echo "==> removing $dir"
    # prune keeps a locked worktree's registration, which would refuse the name.
    if claimed_by_creation "$id" "$dir" && worktree_locked "$dir"; then
      git -C "$main_root" worktree unlock "$dir" || { note_remaining "could not unlock $dir"; return 1; }
    fi
    added="$(record_field "$id" dir_added)"
    set_record_field "$id" dir_added "" || { note_remaining "could not update the record for $name"; return 1; }
    { rm -rf "$trash" && mv "$dir" "$trash"; } || {
      set_record_field "$id" dir_added "$added"
      note_remaining "could not move $dir aside to delete it"
      return 1
    }
  fi
  # 'git worktree remove --force' has failed partway through a node_modules
  # this size and deregistered the worktree anyway.
  rm -rf "$trash" || { note_remaining "could not delete all of $trash"; return 1; }
  git -C "$main_root" worktree prune || { note_remaining "git worktree prune failed after removing $dir"; return 1; }

  git -C "$main_root" show-ref --verify --quiet "refs/heads/$branch" || return 0
  from="$(record_field "$id" branch_from)"
  if [[ "$(record_field "$id" branch_created)" == 0 ]]; then
    kept_branches+="  $branch (existed before $name)"$'\n'
  elif [[ "$(record_field "$id" branch_added)" == 1 ]]; then
    echo "==> deleting branch $branch"
    git -C "$main_root" branch -D "$branch" >/dev/null || { note_remaining "could not delete branch $branch"; return 1; }
  elif branch_checked_out "$branch"; then
    # update-ref, unlike branch -D, deletes a branch checked out elsewhere,
    # which this worktree's branch never is once its tree is gone.
    kept_branches+="  $branch (checked out in another worktree)"$'\n'
  elif [[ -z "$from" ]]; then
    kept_branches+="  $branch (not made by $name)"$'\n'
  elif [[ "$(git -C "$main_root" rev-parse --verify --quiet "refs/heads/$branch")" == "$from" ]]; then
    echo "==> deleting branch $branch"
    # The old value makes the deletion fail if the branch moves after the check.
    git -C "$main_root" update-ref -d "refs/heads/$branch" "$from" || { note_remaining "could not delete branch $branch"; return 1; }
  else
    kept_branches+="  $branch (moved since $name may have made it)"$'\n'
  fi
}

# Under the registry lock, so a scan sees a record whole or not at all.
delete_record() {
  local graveyard status=0
  graveyard="$(graveyard_for "$1")"
  acquire_lock "$registry_lock" "the worktree registry" 8 ||
    { note_remaining "could not lock the worktree registry to delete the record $instances/$1"; return 1; }
  mv "$instances/$1" "$graveyard" || status=1
  release_lock 8
  (( status == 0 )) || { note_remaining "could not delete the record $instances/$1"; return 1; }
  rm -rf "$graveyard"
}

remove_instance() {
  local id="$1" name status=0
  name="$(record_field "$id" name)"
  acquire_lock "$instances/$id/lock" "worktree ${name:-$id}" 9 || status=$?
  # Gone means a concurrent run finished it.
  (( status != 1 )) || return 0
  (( status == 0 )) || { note_remaining "could not lock worktree ${name:-$id}"; return 1; }
  remove_owned_resources "$id" && delete_record "$id" || status=1
  release_lock 9
  (( status == 0 )) || return 1
  echo "==> removed $name"
}

children_of() { awk -v parent="$1" '$2 == parent { print $1 }' <<<"$edges"; }

# A chain deeper than the number of records loops, and following it would hang
# with the registry lock held.
descendants_of() {
  local child depth="${2:-0}"
  (( depth < $(wc -l <<<"$edges") )) ||
    die "worktree records under $(record_field "$1" name) form a parent loop — fix or remove those records"
  for child in $(children_of "$1"); do
    echo "$child"
    descendants_of "$child" $(( depth + 1 ))
  done
}

# Keeping a parent whose descendant remains keeps the record that leads a rerun
# back to that descendant.
remove_subtree() {
  local id="$1" child kept=0
  for child in $(children_of "$id"); do
    remove_subtree "$child" || kept=1
  done
  if (( kept )); then
    note_remaining "$(record_field "$id" name) was kept because a descendant remains"
    return 1
  fi
  remove_instance "$id"
}

# Read outside the lock, a record a concurrent removal deletes would look
# malformed. A record seen before the lock and gone or replaced under it was
# removed by that run, and any record not seen before it belongs to a newer
# creation.
seen="$(records_with name "$name")"
mkdir -p "$instances"
acquire_lock "$registry_lock" "the worktree registry" 8
sweep_registry_leftovers
target="$(records_with name "$name")"
if [[ "$target" != "$seen" ]]; then
  release_lock 8
  [[ -n "$seen" ]] || die "$name was recorded by a creation that started after this run, so it was kept — rerun to remove it"
  echo "$name was removed by another run"
  exit 0
fi
if [[ -z "$target" ]]; then
  release_lock 8
  remove_worktree_by_name "$name"
  exit 0
fi

[[ "$target" != *$'\n'* ]] ||
  die "more than one worktree record in $instances names $name, so nothing was removed — remove the extra one"

# A record with no readable parent might be a descendant, so nothing is removed
# until it is fixed.
edges="$(
  for dir in "$instances"/*/; do
    id="$(basename "$dir")"
    [[ -d "$dir" ]] || continue
    parent="$(record_field "$id" parent)"
    if ! valid_id "$id" || ! valid_parent "$parent"; then
      die "worktree record $dir has no valid id and parent, so whether it is part of this removal is unknown — fix or remove that record"
    fi
    echo "$id $parent"
  done
)"

selected="$target"$'\n'"$(descendants_of "$target")"

for id in $selected; do
  problem="$(record_problem "$id")"
  [[ -z "$problem" ]] || die "worktree record $instances/$id $problem, so nothing was removed — fix or remove that record"
  dir="$(record_field "$id" dir)"
  if claimed_by_creation "$id" "$dir"; then
    refuse_current_checkout "$dir"
  else
    refuse_unremovable "$dir"
  fi
  # --list hides the lineage of the checkout holding this script too, wherever
  # the working directory is.
  [[ "$dir" != "$repo_root" ]] ||
    die "$dir holds the rm-worktree.sh running now, and this removal includes it. Run the main checkout's scripts/rm-worktree.sh instead."
done

stamp="$(process_stamp $$)" || die "ps cannot report this run's start time, so its removal flag could not be told from a stale one"
for id in $selected; do
  rm -f "$instances/$id/removing"
  ln -sn "$stamp" "$instances/$id/removing"
done
release_lock 8

load_main_db_settings

remove_subtree "$target" || true

if [[ -n "$kept_branches" ]]; then
  echo "kept branches:"
  printf '%s' "$kept_branches"
fi

if [[ -n "$remaining" ]]; then
  echo "error: cleanup incomplete; rerun the same command once these are resolved:" >&2
  printf '%s' "$remaining" >&2
  exit 1
fi

echo "done"

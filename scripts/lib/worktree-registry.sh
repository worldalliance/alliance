#!/usr/bin/env bash
# Ownership records for the worktree scripts. Source after worktree-paths.sh.
#
# instances/<id>/record names everything one creation owns. A record is written
# before any resource exists and deleted only after all of them are gone, so an
# interrupted creation or removal stays identifiable and a rerun resumes from it.
# Names, port slots, databases and branches are claimed by the records
# that hold them, checked and written under the registry lock.

registry="$git_common_dir/alliance-worktrees"
instances="$registry/instances"
registry_lock="$registry/lock"

valid_id() { [[ "$1" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; }

record_field() {
  local file="$instances/$1/record"
  [[ -f "$file" ]] || return 0
  awk -v key="$2" 'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' "$file"
}

set_record_field() {
  local file="$instances/$1/record"
  # awk -v expands backslash escapes in a value; ENVIRON does not.
  val="$3" awk -v key="$2" '
    index($0, key "=") == 1 { next }
    { print }
    END { print key "=" ENVIRON["val"] }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

records_with() {
  local dir id
  for dir in "$instances"/*/; do
    id="$(basename "$dir")"
    [[ -f "$dir/record" && "$(record_field "$id" "$1")" == "$2" ]] && echo "$id"
  done
  return 0
}

record_fields() {
  local dir id
  for dir in "$instances"/*/; do
    id="$(basename "$dir")"
    [[ -f "$dir/record" ]] && record_field "$id" "$1"
  done
  return 0
}

# A removal moves a record here under the registry lock before deleting it. The
# suffix is the remover's pid.
graveyard_for() { echo "$instances/.deleted-$1-$$"; }

# Call holding the registry lock. A creation moves its staged record into place
# before releasing that lock, so a staging directory seen under it was left by a
# creation that stopped. A graveyard outlives a removal whose rm -rf failed or
# that was killed, and is skipped while its remover still runs.
sweep_registry_leftovers() {
  local dir
  rm -rf "$instances"/.new-*
  for dir in "$instances"/.deleted-*; do
    [[ -e "$dir" ]] || continue
    kill -0 "${dir##*-}" 2>/dev/null || rm -rf "$dir"
  done
}

db_name_for() { echo "alliance_${1//-/_}"; }

# --branch expands @{-N} shorthand, so only a name it returns unchanged is a branch.
valid_branch() { [[ -n "$1" && "$(git check-ref-format --branch "$1" 2>/dev/null)" == "$1" ]]; }

# Prints what is wrong with a record, or nothing. Its directory and database
# names must be the ones its name derives, so an edited record can name only an
# alliance-<name> directory beside the main checkout and alliance_<name>
# databases, never an arbitrary path or database.
record_problem() {
  local id="$1" name parent db
  [[ -f "$instances/$id/record" ]] || { echo "has no record file"; return 0; }
  name="$(record_field "$id" name)"
  parent="$(record_field "$id" parent)"
  db="$(db_name_for "$name")"
  valid_name "$name" || { echo "has an invalid name '$name'"; return 0; }
  [[ "$parent" == main ]] || valid_id "$parent" || { echo "has an invalid parent '$parent'"; return 0; }
  [[ "$(record_field "$id" dir)" == "$(worktree_dir_for "$name")" ]] || { echo "names a directory other than $(worktree_dir_for "$name")"; return 0; }
  [[ "$(record_field "$id" dir)" != "$main_root" ]] || { echo "names the main checkout"; return 0; }
  [[ "$(record_field "$id" db)" == "$db" && "$(record_field "$id" test_db)" == "${db}_test" ]] ||
    { echo "names databases other than $db and ${db}_test"; return 0; }
  valid_branch "$(record_field "$id" branch)" || { echo "has an invalid branch"; return 0; }
  [[ "$(record_field "$id" branch_created)" =~ ^[01]$ ]] || { echo "has an invalid branch_created"; return 0; }
  [[ "$(record_field "$id" branch_added)" =~ ^1?$ ]] || { echo "has an invalid branch_added"; return 0; }
  [[ "$(record_field "$id" dir_added)" =~ ^1?$ ]] || { echo "has an invalid dir_added"; return 0; }
  [[ "$(record_field "$id" slot)" =~ ^[0-9]+$ ]] || { echo "has an invalid slot"; return 0; }
}

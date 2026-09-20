#!/usr/bin/env bash
# Fails when a tracked file is also matched by a .gitignore rule, or when a
# rule names a directory without anchoring it.
#
# Git keeps serving a tracked file it also ignores, so the repo looks fine
# locally and in review. Tools that re-apply the ignore rules rather than
# asking git drop it instead: the EAS project archive does, which moves a
# mobile build's runtime fingerprint off the one every local tool computes.
#
# The tracked-file check reads the index, so it cannot see a file an
# over-broad pattern swallowed before anyone committed it, because `git add
# -A` skips ignored paths without a word. The anchoring check covers that
# case for rules ending in `/` and rules like `**/build/**`, when the pattern
# is written. A bare `build` or `**/build` rule gets past it: nothing in the
# text says it names a directory.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

status=0

# --exclude-per-directory reads .gitignore and nothing else, so a personal rule
# in core.excludesFile or .git/info/exclude cannot fail a run that passes for
# everyone else.
offenders="$(git ls-files --cached --ignored --exclude-per-directory=.gitignore)"

if [[ -n "$offenders" ]]; then
  echo "Tracked files matched by ignore rules:" >&2
  git check-ignore --no-index --verbose --stdin <<<"$offenders" >&2
  echo >&2
  echo "Each line starts with the rule that matched. Anchor the pattern to the one directory it means (/android/ rather than android/), or narrow it." >&2
  echo "If the rule is right and the file should never have been committed, untrack it with git rm --cached." >&2
  status=1
fi

any_depth=()
while IFS= read -r entry || [[ -n "$entry" ]]; do
  if [[ -n "$entry" && "$entry" != '#'* ]]; then
    any_depth+=("$entry")
  fi
done <scripts/gitignore-any-depth.txt

contains() {
  local needle="$1" entry
  shift
  for entry in "$@"; do
    if [[ "$entry" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

# Bash before 4.4 treats an empty "${array[@]}" as unbound under set -u, hence
# the ${array[@]+...} guards.
matched=()
unanchored=()
while IFS= read -r -d '' file; do
  # A tracked .gitignore deleted from the worktree is one git no longer reads.
  if [[ ! -e "$file" ]]; then
    continue
  fi
  line_no=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))
    # Git drops a trailing CR and trailing spaces before matching.
    line="${line%$'\r'}"
    line="${line%"${line##*[! ]}"}"
    if [[ "$line" == [#!]* ]]; then
      continue
    fi
    # A leading **/ or /**/ matches at every depth. It names a directory when
    # nothing follows it or what follows ends in /, /* or /**.
    rest="${line#/}"
    if [[ "$rest" == '**/'* ]]; then
      rest="${rest#'**/'}"
      if [[ -n "$rest" && "$rest" != */ && "$rest" != */'*' && "$rest" != */'**' ]]; then
        continue
      fi
    elif [[ "$line" != */ || "${line%/}" == */* ]]; then
      continue
    fi
    if contains "$file:$line" ${any_depth[@]+"${any_depth[@]}"}; then
      matched+=("$file:$line")
    else
      unanchored+=("$file:$line_no:$line")
    fi
  done 2>/dev/null <"$file" || {
    echo "Cannot read $file" >&2
    status=1
  }
# -z keeps git from quoting paths with unusual characters, which would name a
# file that does not exist. --others adds a .gitignore not yet staged, which
# git already applies. --exclude-standard leaves out one a personal exclude
# hides, since git never descends into its directory.
done < <(git ls-files -z --cached --others --exclude-standard -- .gitignore '*/.gitignore')

if [[ ${#unanchored[@]} -gt 0 ]]; then
  echo "Ignore rules that name a directory without anchoring it:" >&2
  printf '%s\n' "${unanchored[@]}" >&2
  echo >&2
  echo "Write /android/ for the one directory the rule means. A rule that means every depth goes in scripts/gitignore-any-depth.txt, as <gitignore path>:<pattern>." >&2
  status=1
fi

stale=()
for entry in ${any_depth[@]+"${any_depth[@]}"}; do
  if ! contains "$entry" ${matched[@]+"${matched[@]}"}; then
    stale+=("$entry")
  fi
done

if [[ ${#stale[@]} -gt 0 ]]; then
  echo "Entries in scripts/gitignore-any-depth.txt that match no rule:" >&2
  printf '%s\n' "${stale[@]}" >&2
  echo >&2
  echo "Delete them, so the list names only rules the repo has." >&2
  status=1
fi

if [[ $status -eq 0 ]]; then
  echo "No tracked file is matched by an ignore rule, and every directory rule is anchored or listed in scripts/gitignore-any-depth.txt."
fi

exit "$status"

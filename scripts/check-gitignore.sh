#!/usr/bin/env bash
# Fails when a tracked file is also matched by a .gitignore rule.
#
# Git keeps serving such a file, so the repo looks fine locally and in review.
# Tools that re-apply the ignore rules rather than asking git drop it instead:
# the EAS project archive does, which moves a mobile build's runtime
# fingerprint off the one every local tool computes.
#
# Tracked files only. A file an over-broad pattern swallowed before anyone
# committed it leaves nothing here to find, because `git add -A` skips ignored
# paths without a word.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

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
  exit 1
fi

echo "No tracked file is matched by an ignore rule."

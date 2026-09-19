#!/usr/bin/env bash
set -euo pipefail

# An empty prefix matches every branch, closing every open pull request.
if [ -z "$PREFIX" ]; then
  echo "::error::supersedes names no branch prefix."
  exit 1
fi
# Checked here rather than where they are read, since a missing token surfaces
# only after the force-push, leaving a branch behind with no pull request.
for var in GH_TOKEN GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL; do
  if [ -z "${!var:-}" ]; then
    echo "::error::open-superseding-pr needs $var."
    exit 1
  fi
done

git switch -c "$BRANCH"
# -A rather than -a, so a file the caller's generator newly emits reaches the
# pull request instead of staying untracked.
git add -A
if git diff --cached --quiet; then
  echo "::error::the working tree carries no change to open a pull request for."
  exit 1
fi
git commit -m "$TITLE"
git push --force origin "$BRANCH"

url=$(gh pr create --head "$BRANCH" --title "$TITLE" --body "$BODY")
superseded=$(gh pr list --state open --limit 1000 --json number,headRefName \
  --jq '.[] | select(.headRefName | startswith(env.PREFIX)) | select(.headRefName != env.BRANCH) | .number')
for pr in $superseded; do
  gh pr close "$pr" --delete-branch --comment "Superseded by $url." \
    || echo "::warning::gh pr close --delete-branch failed for #$pr; check whether it is still open and its branch still exists."
done

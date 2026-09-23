#!/usr/bin/env bash
set -euo pipefail

# An empty prefix matches every branch, closing every open pull request.
read -ra prefixes <<< "$PREFIXES"
if [ ${#prefixes[@]} -eq 0 ]; then
  echo "::error::supersedes names no branch prefix."
  exit 1
fi
export PREFIXES="${prefixes[*]}"
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
AUTHOR=$(gh pr view "$url" --json author --jq .author.login)
export AUTHOR
# Only pull requests this token's identity opened, so a person's branch that
# shares a prefix is never closed and deleted.
# jq rather than gh's --jq, whose built-in gojq is not what jq-filters.test.ts runs.
superseded=$(gh pr list --state open --limit 1000 --json number,headRefName,author \
  | jq -r -f "$(dirname "$0")/superseded.jq")
gh label create superseded --force --color ededed \
  --description "Closed by the tzdb release watch in favor of a newer pull request"
for pr in $superseded; do
  # Unlabeled, a closed pull request reads as declined, so it stays open.
  if ! gh pr edit "$pr" --add-label superseded; then
    echo "::warning::labeling #$pr as superseded failed, so it stays open."
  elif ! gh pr close "$pr" --delete-branch --comment "Superseded by $url."; then
    # Labeled but open, a later close by hand would read as superseded rather
    # than declined. gh fails here too when only the branch delete fails.
    # A failed lookup counts as open.
    state=$(gh pr view "$pr" --json state --jq .state) || state=unknown
    if [ "$state" != CLOSED ] && [ "$state" != MERGED ]; then
      gh pr edit "$pr" --remove-label superseded \
        || echo "::warning::removing the superseded label from open #$pr failed; remove it by hand."
    fi
    echo "::warning::closing #$pr as superseded failed; check whether it is still open and its branch still exists."
  fi
done

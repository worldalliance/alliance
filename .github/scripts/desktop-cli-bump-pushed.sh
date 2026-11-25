#!/usr/bin/env bash
# Prints the first open bump pull request for the CLI named in $1 that someone other than $GIT_AUTHOR_EMAIL has pushed to, since superseding it or recording again onto it would drop their commits.
set -euo pipefail

# Commits are read one pull request at a time, since listing them for every open one exceeds GitHub's GraphQL node limit.
bumps=$(gh pr list --state open --limit 1000 --json number,headRefName,isCrossRepository \
  | PREFIX="desktop-cli/$1/" jq -r '.[] | select((.isCrossRepository | not) and (.headRefName | startswith($ENV.PREFIX))) | .number')
for pr in $bumps; do
  commits=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr/commits?per_page=100")
  pushed=$(BOT_EMAIL="$GIT_AUTHOR_EMAIL" jq -f "$(dirname "$0")/pushed-by-others.jq" <<< "$commits")
  if [ "$pushed" = true ]; then
    echo "$pr"
    exit 0
  fi
done

#!/usr/bin/env bash
# Bumps @formatjs/intl-datetimeformat within server/package.json's range, and
# keeps the bump only when it changes add-all-tz.js and no tzdb/ pull request
# the watch opened ends with that tz data reverted, or merged naming it while
# the checkout lacks it. Such a pull request means someone declined that tz data.
# Writes version, tzdata, and the bump's commit message to $GITHUB_OUTPUT when
# it keeps the bump, and tzdata and the declining pull requests when it drops a
# declined one.
set -euo pipefail
cd "$(dirname "$0")/../../server"

tzdata() { shasum < "$(bun -p 'require.resolve("@formatjs/intl-datetimeformat/add-all-tz.js")')" | cut -c1-12; }

before=$(tzdata)
bun update @formatjs/intl-datetimeformat
after=$(tzdata)
# The hash leads, since GitHub cuts commit headlines off at 69 characters and
# the decline checks read the headline of the bump's commit and its revert.
headline="add-all-tz.js SHA-1 $after"
if [ "$after" != "$before" ]; then
  declined_by=()
  catalog_prs=$(gh pr list --state all --limit 1000 --author app/github-actions --search "head:tzdb/" \
    --json number,headRefName --jq '.[] | select(.headRefName | startswith("tzdb/")) | .number')
  # One at a time: listing commits for many pull requests at once exceeds GitHub's GraphQL node limit.
  for pr in $catalog_prs; do
    # jq rather than gh's --jq, whose built-in gojq is not what jq-filters.test.ts runs.
    declines=$(gh pr view "$pr" --json state,body,commits \
      | AFTER="$after" HEADLINE="$headline" jq -f ../.github/scripts/tzdb-pr-declined.jq)
    if [ "$declines" -gt 0 ]; then
      declined_by+=("#$pr")
    fi
  done
  if [ ${#declined_by[@]} -eq 0 ]; then
    version=$(bun -p 'require("@formatjs/intl-datetimeformat/package.json").version')
    {
      echo "version=$version"
      echo "tzdata=$after"
      echo "message=$headline: bump @formatjs/intl-datetimeformat to $version"
    } >> "$GITHUB_OUTPUT"
    exit 0
  fi
  echo "::notice::Dropping tz data $after, which ${declined_by[*]} declined."
  {
    echo "tzdata=$after"
    echo "declined=${declined_by[*]}"
  } >> "$GITHUB_OUTPUT"
fi
git checkout -- package.json ../bun.lock
bun install --frozen-lockfile

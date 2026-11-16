#!/usr/bin/env bash
# Prints the commit live in environment $1: the newest of its newest 100
# deployments in `$1-live` whose newest status is success. Prints nothing
# when none is. GitHub lists deployments and their statuses newest first,
# which is observed, not documented.
set -euo pipefail

repo="repos/$GITHUB_REPOSITORY"
deployments=$(gh api "$repo/deployments?environment=$1-live&per_page=100" --jq '.[] | "\(.id) \(.sha)"')
while read -r id sha; do
  [ -n "$id" ] || continue
  state=$(gh api "$repo/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""')
  if [ "$state" = success ]; then
    echo "$sha"
    exit 0
  fi
done <<< "$deployments"

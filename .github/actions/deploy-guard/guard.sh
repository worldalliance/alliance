#!/usr/bin/env bash
set -euo pipefail

[[ $COMMIT =~ ^[0-9a-f]{40}$ ]] || { echo "commit must be a full SHA: '$COMMIT'" >&2; exit 1; }
jq -en --argjson details "$DETAILS" '$details | type == "object"' > /dev/null 2>&1 || { echo "details must be a JSON object: '$DETAILS'" >&2; exit 1; }

repo="repos/$GITHUB_REPOSITORY"
record="$ENVIRONMENT-live"

skip() {
  echo "::notice::Not deploying $COMMIT to $ENVIRONMENT: $1"
  echo "Not deploying \`$COMMIT\` to $ENVIRONMENT: $1" >> "$GITHUB_STEP_SUMMARY"
  echo "deployment_id=" >> "$GITHUB_OUTPUT"
  exit 0
}

case "$ENVIRONMENT" in
  staging)
    # The newest record counts whatever its state, since a newer deploy that
    # failed may already have reached the hosts. GitHub lists deployments
    # newest first, which is observed, not documented.
    latest=$(gh api "$repo/deployments?environment=$record&per_page=1" --jq '.[0].sha // ""')
    if [ -n "$latest" ] && [ "$latest" != "$COMMIT" ]; then
      status=$(gh api "$repo/compare/$COMMIT...$latest" --jq .status)
      case "$status" in
        ahead) skip "a deploy of $latest, a newer commit, already started on staging." ;;
        behind | diverged) ;;
        *)
          echo "unexpected compare status: '$status'" >&2
          exit 1
          ;;
      esac
    fi
    ;;
  production)
    tip=$(gh api "$repo/git/ref/heads/production" --jq .object.sha)
    [ "$tip" = "$COMMIT" ] || skip "the production branch now points at $tip."
    ;;
  *)
    echo "unknown environment: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

production_environment=false
[ "$ENVIRONMENT" != production ] || production_environment=true
# required_contexts is empty because the checks gating this deploy already
# passed, in this run or the one whose artifacts it deploys; GitHub would
# otherwise demand every commit status.
id=$(jq -n --arg ref "$COMMIT" --arg environment "$record" --argjson production "$production_environment" \
  --argjson details "$DETAILS" \
  '{ref: $ref, environment: $environment, auto_merge: false, required_contexts: [], production_environment: $production, payload: $details}' \
  | gh api -X POST "$repo/deployments" --input - --jq .id)
# auto_inactive=false keeps GitHub from marking the live record inactive,
# which live-commit.sh would stop reading as live.
gh api -X POST "$repo/deployments/$id/statuses" -f state=in_progress -f log_url="$RUN_URL" -F auto_inactive=false --silent
echo "deployment_id=$id" >> "$GITHUB_OUTPUT"

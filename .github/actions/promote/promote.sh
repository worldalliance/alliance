#!/usr/bin/env bash
# Outputs the id of $COMMIT's newest staging Deploy run and the artifacts
# production deploys from it, when that run is fully green and has them.
# Otherwise outputs no run, and the production run builds the commit itself.
#
# Every API call runs as a plain statement: bash ignores `set -e` in
# conditions and, outside POSIX mode, inside command substitutions, so a
# failed call would read as data instead of failing the job.
set -euo pipefail

[[ $COMMIT =~ ^[0-9a-f]{40}$ ]] || { echo "commit must be a full SHA: '$COMMIT'" >&2; exit 1; }

repo="repos/$GITHUB_REPOSITORY"
ARTIFACTS=(react-build admin-build react-assets)
# Source maps are best-effort, as their upload is.
REQUIRED_ARTIFACTS=(react-build admin-build)
# deploy-checks.yaml's `passed` stands for every check and build.
REQUIRED=(
  "checks / passed"
  "deploy / deploy-nest-backend"
  "deploy / deploy-react-app"
  "deploy / deploy-admin-app"
  "deploy / verify-deployment"
  "deploy / verify-https"
  "deploy / verify-api"
)

# Three tries per read. Output waits for a try that succeeds, since a
# paginated read can fail midway.
api() {
  local out i
  for i in 1 2 3; do
    out=$(gh api "$@") && { printf '%s\n' "$out"; return; }
    [ "$i" = 3 ] && return 1
    sleep $((i * 10))
  done
}

build() {
  echo "Building \`$COMMIT\` in this run: $1" >> "$GITHUB_STEP_SUMMARY"
  exit 0
}

run=$(api "$repo/actions/workflows/deploy.yaml/runs?branch=main&event=push&head_sha=$COMMIT&per_page=1" \
  --jq '.workflow_runs[] | "\(.id) \(.html_url)"')
read -r id url <<< "$run"
[ -n "${id:-}" ] || build "it has no staging Deploy run."

jobs=$(api --paginate "$repo/actions/runs/$id/jobs?filter=latest&per_page=100" \
  --jq '.jobs[] | "\(.conclusion // .status)\t\(.name)"')
unmet=""
for name in "${REQUIRED[@]}"; do
  state=$(awk -F'\t' -v name="$name" '$2 == name { print $1; exit }' <<< "$jobs")
  [ "$state" = success ] || unmet="${unmet:+$unmet, }$name (${state:-missing})"
done
[ -z "$unmet" ] || build "its staging run $url isn't fully green: $unmet."

# A name listed twice builds: ids don't follow upload order, so nothing tells
# which copy a download by name reads.
listed=$(api --paginate "$repo/actions/runs/$id/artifacts?per_page=100" \
  --jq '.artifacts[] | select(.expired | not) | {name, id}' \
  | jq -sc --args 'map(select(.name | IN($ARGS.positional[]))) | group_by(.name)' "${ARTIFACTS[@]}")
twice=$(jq -r 'map(select(length > 1) | .[0].name) | join(", ")' <<< "$listed")
[ -z "$twice" ] || build "its staging run $url lists artifacts more than once: $twice."
artifacts=$(jq -c 'map({(.[0].name): .[0].id}) | add // {}' <<< "$listed")
missing=$(jq -r --args '. as $ids | [$ARGS.positional[] | select($ids[.] == null)] | join(", ")' \
  "${REQUIRED_ARTIFACTS[@]}" <<< "$artifacts")
[ -z "$missing" ] || build "its staging run $url lacks unexpired artifacts: $missing."

{
  echo "run_id=$id"
  echo "artifact_ids=$artifacts"
  echo "details=$(jq -c --arg run "$url" '{staging_run: $run, artifacts: .}' <<< "$artifacts")"
} >> "$GITHUB_OUTPUT"
echo "Promoting \`$COMMIT\` from its fully green staging run $url, artifacts \`$artifacts\`." >> "$GITHUB_STEP_SUMMARY"

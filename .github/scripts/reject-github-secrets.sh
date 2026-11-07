#!/usr/bin/env bash
# Fails on any use of the secrets context in the workflow and action YAML under
# the given directory, .github by default, other than secrets.GITHUB_TOKEN, and
# on any read of the aws action's secrets output without the || '{}' fallback.
set -euo pipefail

dir=${1:-.github}
[ -d "$dir" ] || { echo "::error::$dir not found" >&2; exit 1; }
matches=$(grep -rnoiE --include='*.yml' --include='*.yaml' '(^|[^[:alnum:]_.-])secrets[[:space:]]*(\.[[:alnum:]_*]+|[[)}<>]|[=!]=|&&|\|\|)|[(,][[:space:]]*secrets[[:space:]]*,|secrets[[:space:]]*:[[:space:]]*["'\'']?inherit' "$dir") || [ $? -eq 1 ]
offending=$(grep -viE 'secrets\.GITHUB_TOKEN$' <<< "$matches") || [ $? -eq 1 ]
if [ -n "$offending" ]; then
  echo "$offending"
  echo "::error::Read CI secrets from Parameter Store through ./.github/actions/aws, not GitHub secrets (docs/ci-secrets.md)."
  exit 1
fi

lookups=$(grep -rnoiE --include='*.yml' --include='*.yaml' 'fromJSON\([[:space:]]*steps\.[[:alnum:]_-]+\.outputs(\.secrets|\[[[:space:]]*'\''secrets'\''[[:space:]]*\])[^)]*\)' "$dir") || [ $? -eq 1 ]
bare=$(grep -vE "\|\|[[:space:]]*'\{\}'[[:space:]]*\)$" <<< "$lookups") || [ $? -eq 1 ]
if [ -n "$bare" ]; then
  echo "$bare"
  echo "::error::Read the aws action's secrets as fromJSON(steps.aws.outputs.secrets || '{}'), so a skipped aws step doesn't fail the job (docs/ci-secrets.md)."
  exit 1
fi

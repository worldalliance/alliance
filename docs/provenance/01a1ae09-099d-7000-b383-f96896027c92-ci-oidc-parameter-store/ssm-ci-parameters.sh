#!/usr/bin/env bash
# One-time migration from ALL-1960's setup, kept as a record. It copied the CI
# secrets from Infisical project `alliance` (environments staging and prod at
# /, under their GitHub names) into AWS SSM Parameter Store as SecureStrings
# under the names terraform/ci-oidc.tf grants. Values identical in both
# environments were taken from prod. Don't run it again: the parameters are
# edited in Parameter Store directly now. It ran from the repo root, logged in
# to Infisical and with AWS admin credentials, and printed key names only.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../../../server"   # picks up server/.infisical.yaml

dir=$(mktemp -d "$PWD/../.scratch/ssm-ci-copy.XXXXXX")
trap 'rm -rf "$dir"' EXIT

infisical export --env=prod --path=/ --format=json > "$dir/prod.json"
infisical export --env=staging --path=/ --format=json > "$dir/staging.json"

python3 -I - "$dir" <<'PY'
import json, os, subprocess, sys

scratch = sys.argv[1]
source = {env: {s["key"]: s["value"] for s in json.load(open(os.path.join(scratch, f"{env}.json")))}
          for env in ("prod", "staging")}
copies = {
    "ci/review/CLAUDE_CODE_OAUTH_TOKEN": "prod",
    "ci/review/OPENAI_API_KEY": "prod",
    "ci/review/SLACK_WEBHOOK_URL_CLA": "prod",
    "ci/pr-screenshots/PR_SCREENSHOTS_GH_TOKEN": "prod",
    "ci/shared/SLACK_WEBHOOK_URL_DEPLOYMENT": "prod",
    "ci/deploy/POSTHOG_SOURCEMAP_KEY": "prod",
    "ci/visual-regression/GEMINI_API_KEY": "prod",
    "ci/visual-regression/ANTHROPIC_API_KEY": "prod",
    "ci/visual-regression/SLACK_BOT_TOKEN": "prod",
    "ci/deploy/EXPO_ACCESS_TOKEN": "prod",
    "staging/ci/ASC_API_ISSUER_ID": "staging",
    "staging/ci/ASC_API_KEY_ID": "staging",
    "staging/ci/ASC_API_KEY_P8_BASE64": "staging",
    "staging/ci/PLAY_SERVICE_ACCOUNT_JSON": "staging",
}
request = os.path.join(scratch, "request.json")
for name, env in copies.items():
    key = name.rsplit("/", 1)[1]
    value = source[env].get(key)
    if not value:
        sys.exit(f"{key} is missing or empty in Infisical {env}")
    with open(request, "w") as f:
        json.dump({"Name": f"/alliance/{name}", "Value": value, "Type": "SecureString"}, f)
    subprocess.run(["aws", "ssm", "put-parameter", "--region", "us-west-2",
                    "--cli-input-json", f"file://{request}"],
                   check=True, stdout=subprocess.DEVNULL)
    print(f"/alliance/{name}")
PY

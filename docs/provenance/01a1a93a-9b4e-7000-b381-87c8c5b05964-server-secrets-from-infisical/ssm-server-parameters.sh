#!/usr/bin/env bash
# One-time migration from ALL-1963's setup, kept as a record. It copied
# Infisical's /server folders in staging and prod, which infisical-server-folder.sh
# had filled, into AWS SSM Parameter Store as SecureStrings under
# /alliance/<env>/server/. Don't run it again: the parameters are edited in
# Parameter Store directly now. It ran as .scratch/ssm-server-parameters.sh from
# the repo root, logged in to Infisical and with AWS admin credentials, and
# printed key names only.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../server"   # picks up server/.infisical.yaml

dir=$(mktemp -d "$PWD/../.scratch/ssm-copy.XXXXXX")
trap 'rm -rf "$dir"' EXIT

for env in staging prod; do
  echo "== $env"
  infisical export --env="$env" --path=/server --format=json > "$dir/secrets.json"
  python3 -I - "$env" "$dir" <<'PY'
import json, os, subprocess, sys

env, scratch = sys.argv[1], sys.argv[2]
request = os.path.join(scratch, "request.json")
for secret in json.load(open(os.path.join(scratch, "secrets.json"))):
    with open(request, "w") as f:
        json.dump({"Name": f"/alliance/{env}/server/{secret['key']}",
                   "Value": secret["value"], "Type": "SecureString"}, f)
    subprocess.run(["aws", "ssm", "put-parameter", "--region", "us-west-2",
                    "--cli-input-json", f"file://{request}"],
                   check=True, stdout=subprocess.DEVNULL)
PY
  aws ssm get-parameters-by-path --region us-west-2 --path "/alliance/$env/server/" \
    --query 'Parameters[].Name' --output text | tr '\t' '\n' | sed 's#.*/##' | sort | tr '\n' ' '
  echo
done

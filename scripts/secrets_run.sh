#!/usr/bin/env bash
#
# The deploy installs this as ~/secrets_run.sh, outside any release, so a
# rollback starts the previous release through it too.

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: secrets_run.sh <command> [args...]" >&2
  exit 2
fi

case "${NODE_ENV:-}" in
  staging) env_name=staging ;;
  production) env_name=prod ;;
  *)
    echo "secrets_run.sh: no secrets for NODE_ENV='${NODE_ENV:-}'" >&2
    exit 1
    ;;
esac

# Python, not bash, sets the variables: values may hold any character, and
# the decrypted response never touches argv or a file.
exec python3 -I -c '
import json, os, re, subprocess, sys

prefix, command = sys.argv[1], sys.argv[2:]
fetched = subprocess.run(
    ["aws", "ssm", "get-parameters-by-path", "--region", "us-west-2",
     "--path", prefix, "--with-decryption", "--output", "json"],
    stdout=subprocess.PIPE,
)
if fetched.returncode:
    sys.exit(f"secrets_run.sh: could not read {prefix} from Parameter Store")
parameters = json.loads(fetched.stdout)["Parameters"]
if not parameters:
    sys.exit(f"secrets_run.sh: no parameters under {prefix}")
for parameter in parameters:
    full_name = parameter["Name"]
    name = full_name[len(prefix):]
    if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", name):
        sys.exit(f"secrets_run.sh: {full_name} is not an env var name")
    if name in os.environ:
        sys.exit(f"secrets_run.sh: {full_name} would override {name}, which is already set")
    os.environ[name] = parameter["Value"]
os.execvp(command[0], command)
' "/alliance/$env_name/server/" "$@"

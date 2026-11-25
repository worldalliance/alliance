#!/usr/bin/env bash
#
# The deploy installs this as ~/secrets_run.sh, outside any release, so a
# rollback starts the previous release through it too.

set -euo pipefail

usage="usage: secrets_run.sh <command> [args...]
       secrets_run.sh --path <prefix> [NAME...] [--path ...] -- <command> [args...]"

if [ "$#" -eq 0 ]; then
  echo "$usage" >&2
  exit 2
fi

if [ "$1" != --path ]; then
  case "${NODE_ENV:-}" in
    staging) env_name=staging ;;
    production) env_name=prod ;;
    *)
      echo "secrets_run.sh: no secrets for NODE_ENV='${NODE_ENV:-}'" >&2
      exit 1
      ;;
  esac
  set -- --path "/alliance/$env_name/server/" -- "$@"
fi

# Python, not bash, sets the variables: values may hold any character, and
# the decrypted response never touches argv or a file.
exec python3 -I -c '
import json, os, re, subprocess, sys

usage, args = sys.argv[1], sys.argv[2:]
sources, origin = [], {}
while args and args[0] == "--path":
    args.pop(0)
    if not args or not re.fullmatch(r"/[a-z0-9/-]+/", args[0]):
        sys.exit(usage)
    prefix, names = args.pop(0), []
    while args and args[0] not in ("--path", "--"):
        names.append(args.pop(0))
    sources.append((prefix, names))
if not args or args[0] != "--" or len(args) < 2:
    sys.exit(usage)
command = args[1:]

for prefix, names in sources:
    fetched = subprocess.run(
        ["aws", "ssm", "get-parameters-by-path", "--region", "us-west-2",
         "--path", prefix, "--with-decryption", "--output", "json"],
        stdout=subprocess.PIPE,
    )
    if fetched.returncode:
        sys.exit(f"secrets_run.sh: could not read {prefix} from Parameter Store")
    values = {p["Name"][len(prefix):]: p["Value"] for p in json.loads(fetched.stdout)["Parameters"]}
    if not values:
        sys.exit(f"secrets_run.sh: no parameters under {prefix}")
    if names:
        missing = [name for name in names if name not in values]
        if missing:
            sys.exit("secrets_run.sh: " + prefix + " has no " + ", ".join(missing))
        values = {name: values[name] for name in names}
    for name, value in values.items():
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", name):
            sys.exit(f"secrets_run.sh: {prefix}{name} is not an env var name")
        if name in origin:
            sys.exit(f"secrets_run.sh: {name} is under both {origin[name]} and {prefix}")
        if name in os.environ:
            sys.exit(f"secrets_run.sh: {prefix}{name} would override {name}, which is already set")
        os.environ[name] = value
        origin[name] = prefix
os.execvp(command[0], command)
' "$usage" "$@"

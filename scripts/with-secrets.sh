#!/usr/bin/env bash
#
# Runs a command with a consumer's dev secrets from Parameter Store, read with
# the person's Identity Center login. docs/local-secrets.md has the setup.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: with-secrets.sh <consumer> <command> [args...]" >&2
  exit 2
fi

# Python, not bash, sets the variables: values may hold any character, and
# the decrypted response never touches argv or a file.
# shellcheck disable=SC2016
exec python3 -I -c '
import json, os, re, subprocess, sys

repo_root, consumer, command = sys.argv[1], sys.argv[2], sys.argv[3:]
profile = "alliance-dev"
marker = "ALLIANCE_SECRETS_LOADED"
login = f"aws sso login --profile {profile}"
static_keys = ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN")


def listed(items):
    return ", ".join(items)


def fail(message):
    sys.exit(f"with-secrets.sh: {message}")


def run_command(loaded):
    os.environ[marker] = ",".join(dict.fromkeys([*loaded, consumer]))
    try:
        os.execvp(command[0], command)
    except FileNotFoundError:
        fail(f"command not found: {command[0]}")
    except OSError as error:
        fail(f"cannot run {command[0]}: {error.strerror}")


loaded = [name for name in os.environ.get(marker, "").split(",") if name]
if consumer in loaded:
    run_command(loaded)

with open(os.path.join(repo_root, "scripts/dev-secrets.json")) as manifest:
    consumers = json.load(manifest)
if consumer not in consumers:
    fail(f"unknown consumer {consumer}; expected one of {listed(sorted(consumers))}")
entry = consumers[consumer]
missing_fields = [key for key in ("secrets", "envFile", "loadsEnvFile") if key not in entry]
if missing_fields:
    fail(f"scripts/dev-secrets.json: consumer {consumer} lacks {listed(missing_fields)}")
if not isinstance(entry["loadsEnvFile"], bool):
    fail(f"scripts/dev-secrets.json: consumer {consumer} loadsEnvFile must be true or false")
expected = set(entry["secrets"])
env_file = entry["envFile"]
loads_env_file = entry["loadsEnvFile"]


def env_file_entries(name=env_file):
    with open(os.path.join(repo_root, name)) as lines:
        return dict(match.groups() for match in (re.match(r"\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)", line) for line in lines) if match)


# Bun loads these beside the env file it runs from, each over the ones before it.
bun_env_files = [env_file + suffix for suffix in ("", ".development", ".local", ".development.local")]


# BACKCOMPAT(ALL-1964): remove from here through the fallback block with the
# contract step, once everyone has run without this flag. A consumer that loads
# its own env file gets nothing exported, since shell quoting differs from the
# dotenv parse it does itself.

# The env file was written for `source`, so bash reads it, and as with a bare
# `source` a failing command does not stop it. Parameter Store holds no empty
# value, so empty counts as absent. Values return over a pipe to stay out of
# argv, and the errors from bash, which can quote a value, are cut to line
# numbers.
def sourced(names):
    path = os.path.join(repo_root, env_file)
    script = "set -a; source \"$1\" >/dev/null; shift; for name; do if [ -n \"${!name:-}\" ]; then printf \"%s=%s\\\\0\" \"$name\" \"${!name}\"; fi; done"
    result = subprocess.run(["bash", "-c", script, "_", path, *names], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    lines = sorted(set(re.findall(re.escape(path).encode() + rb": line (\d+):", result.stderr)), key=int)
    if result.returncode != 0 or lines:
        at = f" at line {listed(line.decode() for line in lines)}" if lines else ""
        fail(f"bash cannot source {env_file}{at}; fix it or unset ALLIANCE_SECRETS_ENV_FALLBACK")
    return dict(pair.partition("=")[::2] for pair in result.stdout.decode().split("\0") if pair)


fallback = os.environ.get("ALLIANCE_SECRETS_ENV_FALLBACK")
if fallback not in (None, "1"):
    fail(f"ALLIANCE_SECRETS_ENV_FALLBACK is {fallback}; set it to 1 or unset it")
if fallback == "1":
    if not os.path.exists(os.path.join(repo_root, env_file)):
        fail(f"ALLIANCE_SECRETS_ENV_FALLBACK is set but {env_file} does not exist")
    if loads_env_file:
        found = {name: env_file for name in env_file_entries()}
        for file in bun_env_files[1:]:
            try:
                found |= {name: file for name in env_file_entries(file)}
            except FileNotFoundError:
                continue
        falling_back = sorted((expected - os.environ.keys()) & found.keys())
    else:
        unset = {name for name in expected if not os.environ.get(name)}
        values = sourced(sorted(unset))
        absent = sorted(unset - values.keys())
        if absent:
            fail(f"{env_file} is missing {listed(absent)}; add them or unset ALLIANCE_SECRETS_ENV_FALLBACK to read Parameter Store")
        os.environ.update(values)
        found = dict.fromkeys(values, env_file)
        falling_back = sorted(values)
    for name in falling_back:
        print(f"with-secrets.sh: using {name} from {found[name]}, not Parameter Store", file=sys.stderr)
    run_command(loaded)

takeover = f"secrets are read with the {profile} login, and static keys would take over from it"
static = [name for name in static_keys if name in os.environ]
if static:
    fail(f"unset {listed(static)}; {takeover}")
# Static keys in an env file reach only a consumer that loads it.
for name in bun_env_files if loads_env_file else ():
    try:
        in_file = sorted(set(static_keys) & env_file_entries(name).keys())
    except FileNotFoundError:
        continue
    if in_file:
        fail(f"remove {listed(in_file)} from {name}; {takeover}")
if os.environ.get("AWS_PROFILE", profile) != profile:
    other = os.environ["AWS_PROFILE"]
    fail(f"AWS_PROFILE is {other}; unset it or set it to {profile}")
os.environ["AWS_PROFILE"] = profile
already_set = sorted(expected & os.environ.keys())
if already_set:
    fail(f"{listed(already_set)} already set in this shell; unset them so Parameter Store is the only source")

prefix = f"/alliance/dev/{consumer}/"
try:
    fetched = subprocess.run(
        ["aws", "ssm", "get-parameters-by-path", "--region", "us-west-2",
         "--path", prefix, "--with-decryption", "--output", "json"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
except FileNotFoundError:
    fail("the aws CLI is not installed; see docs/local-secrets.md")
if fetched.returncode:
    detail = fetched.stderr.strip()
    if "could not be found" in detail:
        fail(f"the {profile} AWS profile is not set up; see docs/local-secrets.md\n{detail}")
    if re.search(r"AccessDenied|not authorized|ForbiddenException", detail):
        fail(f"your {profile} login may not read {prefix}; ask an admin to check your {profile} assignment\n{detail}")
    if re.search(r"Token has expired|Error loading SSO Token|refresh failed|ExpiredToken|SSO session|aws sso login|Session token not found or invalid", detail):
        fail(f"your AWS login has expired or is missing; run: {login}\n{detail}")
    fail(f"could not read {prefix} from Parameter Store\n{detail}")

stored = {parameter["Name"][len(prefix):]: parameter["Value"] for parameter in json.loads(fetched.stdout)["Parameters"]}
missing = sorted(expected - stored.keys())
if missing:
    fail(f"{prefix} is missing {listed(missing)}")
# The store is shared, so a key a newer checkout lists must not stop this one.
undeclared = sorted(stored.keys() - expected)
if undeclared:
    print(f"with-secrets.sh: ignoring {listed(undeclared)} in {prefix}, which scripts/dev-secrets.json does not list", file=sys.stderr)
os.environ.update({name: stored[name] for name in expected})
run_command(loaded)
' "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" "$@"

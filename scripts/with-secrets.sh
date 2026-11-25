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
if "secrets" not in entry:
    fail(f"scripts/dev-secrets.json: consumer {consumer} lacks secrets")
expected = set(entry["secrets"])
retiring = set(entry.get("retiring", []))
# A consumer with an envFile loads that file itself.
env_file = entry.get("envFile")
if env_file is not None and not isinstance(env_file, str):
    fail(f"scripts/dev-secrets.json: consumer {consumer} envFile must be a path")
loads_env_file = env_file is not None


def env_file_entries(name):
    with open(os.path.join(repo_root, name)) as lines:
        return dict(match.groups() for match in (re.match(r"\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)", line) for line in lines) if match)


# Bun loads these beside the env file it runs from, each over the ones before it.
bun_env_files = [env_file + suffix for suffix in ("", ".development", ".local", ".development.local")] if loads_env_file else []


# A contributor without team credentials opts out of Parameter Store here; the
# config validation of the app then requires only what they can supply.
without = "ALLIANCE_WITHOUT_TEAM_SECRETS"
setting = os.environ.get(without)
if setting is None and loads_env_file:
    env_files = [f"--env-file={os.path.join(repo_root, name)}" for name in bun_env_files]
    # From the repo root, so the bunfig preload of the consumer does not run.
    probe = subprocess.run(["bun", *env_files, "--print", f"process.env.{without} ?? \"\""], cwd=repo_root, capture_output=True, text=True)
    if probe.returncode != 0:
        fail(f"bun could not read {without} from the env files of {consumer}: {probe.stderr.strip()}")
    setting = probe.stdout.strip()
if setting not in (None, "", "0", "false", "1", "true"):
    fail(f"{without} is {setting}; set it to 1 or 0")
if setting is not None:
    # A consumer that loads fewer env files than Bun, such as dotenv, still
    # agrees with the store choice.
    os.environ[without] = setting
if setting in ("1", "true"):
    print(f"with-secrets.sh: {without} is set, so {consumer} runs without the secrets in Parameter Store", file=sys.stderr)
    run_command(loaded)

takeover = f"secrets are read with the {profile} login, and static keys would take over from it"
static = [name for name in static_keys if name in os.environ]
if static:
    fail(f"unset {listed(static)}; {takeover}")
# Static keys in an env file reach only a consumer that loads it.
for name in bun_env_files:
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
    with open(os.path.join(repo_root, "scripts/aws-login-errors.json")) as patterns:
        login_errors = json.load(patterns)
    if login_errors["profileMissing"] in detail:
        fail(f"the {profile} AWS profile is not set up; see docs/local-secrets.md\n{detail}")
    if re.search(login_errors["accessDenied"], detail):
        fail(f"your {profile} login may not read {prefix}; ask an admin to check your {profile} assignment\n{detail}")
    if re.search(login_errors["loginExpired"], detail):
        fail(f"your AWS login has expired or is missing; run: {login}\n{detail}")
    fail(f"could not read {prefix} from Parameter Store\n{detail}")

stored = {parameter["Name"][len(prefix):]: parameter["Value"] for parameter in json.loads(fetched.stdout)["Parameters"]}
missing = sorted(expected - stored.keys())
if missing:
    fail(f"{prefix} is missing {listed(missing)}")
# The store is shared, so a key a newer checkout lists must not stop this one.
undeclared = sorted(stored.keys() - expected - retiring)
if undeclared:
    print(f"with-secrets.sh: ignoring {listed(undeclared)} in {prefix}, which scripts/dev-secrets.json does not list", file=sys.stderr)
os.environ.update({name: stored[name] for name in expected})
run_command(loaded)
' "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" "$@"

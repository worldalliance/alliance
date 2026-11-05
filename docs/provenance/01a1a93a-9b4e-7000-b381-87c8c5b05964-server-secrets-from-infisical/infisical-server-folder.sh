#!/usr/bin/env bash
# One-time migration from ALL-1963's setup, kept as a record. It created /server
# in Infisical staging and prod and copied the server's secrets into it from /,
# under the server's names; ssm-server-parameters.sh then copied /server into
# Parameter Store, where the secrets are edited now. Don't run it again.
# It ran as .scratch/infisical-server-folder.sh from the repo root, logged in to
# Infisical as a user who can write both environments, and printed key names only.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../server"   # picks up server/.infisical.yaml

# server name=name in /
map='{
  "DB_HOST": "RDS_HOSTNAME",
  "DB_USERNAME": "RDS_USERNAME",
  "DB_PASSWORD": "DB_PASSWORD",
  "JWT_SECRET": "JWT_SECRET",
  "JWT_REFRESH_SECRET": "JWT_REFRESH_SECRET",
  "GOOGLE_CLIENT_SECRET": "GOOGLE_CLIENT_SECRET",
  "APPLE_PRIVATE_KEY_BASE64": "APPLE_PRIVATE_KEY_BASE64",
  "SMTP_HOST": "SMTP_HOST",
  "SMTP_USER": "SMTP_USER",
  "SMTP_PASSWORD": "SMTP_PASSWORD",
  "ASSETS_BUCKET": "ASSETS_BUCKET_NAME",
  "TWILIO_PHONE_NUMBER": "TWILIO_PHONE_NUMBER",
  "TWILIO_ACCOUNT_SID": "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN": "TWILIO_AUTH_TOKEN",
  "POSTHOG_QUERY_KEY": "POSTHOG_QUERY_KEY",
  "MAILGUN_SIGNING_KEY": "MAILGUN_SIGNING_KEY",
  "NOTIF_TEST_PHONE_NUMBER": "NOTIF_TEST_PHONE_NUMBER",
  "SLACK_WEBHOOK_URL": "SLACK_WEBHOOK_URL",
  "PANGRAM_API_KEY": "PANGRAM_API_KEY",
  "EXPO_ACCESS_TOKEN": "EXPO_ACCESS_TOKEN"
}'

dir=$(mktemp -d "$PWD/../.scratch/infisical-server.XXXXXX")
trap 'rm -rf "$dir"' EXIT
file="$dir/server.yaml"

for env in staging prod; do
  echo "== $env"
  infisical secrets folders get --env="$env" --path=/ -o json 2>/dev/null \
    | jq -e '.[] | select(.name == "server")' >/dev/null \
    || infisical secrets folders create --env="$env" --path=/ --name=server >/dev/null
  # JSON is YAML, so `secrets set --file` reads it.
  infisical export --env="$env" --path=/ --format=json \
    | jq --argjson map "$map" '
        (map({key, value}) | from_entries) as $src
        | $map | to_entries
        | map(if $src[.value] == null then error("missing in /: \(.value)") else {key, value: $src[.value]} end)
        | from_entries' > "$file"
  infisical secrets set --env="$env" --path=/server --file="$file" >/dev/null
  infisical export --env="$env" --path=/server --format=json | jq -r '[.[].key] | sort | join(" ")'
done

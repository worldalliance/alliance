#!/usr/bin/env bash
set -euo pipefail

names=()
while IFS= read -r name; do
  name="${name#"${name%%[![:space:]]*}"}"
  name="${name%"${name##*[![:space:]]}"}"
  [ -n "$name" ] && names+=("/alliance/$name")
done <<<"$PARAMETERS"
[ "${#names[@]}" -gt 0 ] || { echo "::error::no parameter names given" >&2; exit 1; }
duplicates=$(printf '%s\n' "${names[@]##*/}" | sort | uniq -d | paste -sd, -)
[ -z "$duplicates" ] || { echo "::error::parameter names share a last segment: $duplicates" >&2; exit 1; }

response=$(aws ssm get-parameters --with-decryption --output json --names "${names[@]}")

missing=$(jq -r '.InvalidParameters | join(", ")' <<<"$response")
if [ -n "$missing" ]; then
  echo "::error::not in Parameter Store: $missing" >&2
  exit 1
fi

# A multi-line value is masked line by line to skip lines without a letter or
# digit, like a JSON brace: the runner masks every line of a multi-line mask,
# and masking punctuation would hide it everywhere in later logs. The runner
# unescapes a command's data, so % and CR are escaped as @actions/core's
# setSecret does.
while IFS= read -r line; do
  line=${line//%/%25}
  echo "::add-mask::${line//$'\r'/%0D}"
done < <(jq -r '.Parameters[].Value | if test("\n") then split("\n")[] | select(test("[[:alnum:]]")) else . end' <<<"$response")

delimiter="EOF_$(openssl rand -hex 16)"
{
  echo "secrets<<$delimiter"
  jq -c '.Parameters | map({key: (.Name | split("/") | last), value: .Value}) | from_entries' <<<"$response"
  echo "$delimiter"
} >> "$GITHUB_OUTPUT"

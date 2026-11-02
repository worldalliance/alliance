#!/usr/bin/env bash
set -euo pipefail

tool=${1:?usage: sync.sh claude|codex}
if [[ ${ALLIANCE_AGENT_CHATS:-} == off ]]; then
  echo '{}'
  exit 0
fi
input=$(cat)
session=$(jq -r '.session_id // empty' <<<"$input")
if [[ -z "$session" ]]; then
  echo "agents/chats/sync.sh: hook input has no session_id" >&2
  exit 1
fi
agent_transcript=$(jq -r '.agent_transcript_path // empty' <<<"$input")
transcript=${agent_transcript:-$(jq -r '.transcript_path // empty' <<<"$input")}
if [[ ! -f "$transcript" ]]; then
  echo '{}'
  exit 0
fi

key="$tool/$session.jsonl"
if [[ -n "$agent_transcript" ]]; then
  key="$tool/$session/$(basename "$transcript")"
fi
email=$(git config user.email || true)

if ! AWS_PROFILE=alliance-agent-chats aws s3 cp --only-show-errors \
  ${email:+--metadata "user=$email"} "$transcript" "s3://worldalliance-agent-chats/$key"; then
  echo "agents/chats/sync.sh: upload of $key failed; agents/README.md says how to set uploads up" >&2
  exit 1
fi
echo '{}'

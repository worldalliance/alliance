#!/usr/bin/env bash
set -euo pipefail

proxy_info="$PWD/.scratch/pr-screenshots/claude-proxy.json"
export ANTHROPIC_BASE_URL
ANTHROPIC_BASE_URL="http://127.0.0.1:$(jq -er .port "$proxy_info")"
export CLAUDE_CODE_OAUTH_TOKEN=local-screenshot-run
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

if sudo -n true 2>/dev/null; then
  echo 'Refusing to run PR code with sudo access' >&2
  exit 1
fi

claude -p --dangerously-skip-permissions --output-format stream-json --verbose \
  --no-session-persistence --setting-sources '' --strict-mcp-config \
  < controller/skills/pr-screenshots/REMOTE.md \
  | tee .scratch/pr-screenshots/claude-stream.jsonl

jq -se 'map(select(.type == "result")) | last | .is_error == false' .scratch/pr-screenshots/claude-stream.jsonl

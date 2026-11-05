#!/usr/bin/env bash
set -euo pipefail

# Only exit 2 or a deny on stdout blocks the call; any other failure lets it run.
command -v jq >/dev/null || { echo "block-pkill.sh needs jq: install it" >&2; exit 2; }

cmd=$(jq -r '.tool_input.command // ""')
w='[^[:alnum:]_.-]'
named="(^|$w)(pkill|killall)($w|\$)"
substituted='(\$\(|`)'"([^)\`]*$w)?pgrep($w|\$)"
piped="(^|$w)pgrep($w.*)?\\|(.*$w)?xargs($w.*)?${w}kill($w|\$)"
grep -Eq "$named|$substituted|$piped" <<<"${cmd//$'\n'/ }" || exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "pkill, killall, and pgrep output passed to a command unseen (`$(pgrep …)`, `pgrep … | xargs kill`) are blocked: they act on every process whose name or command line matches, without showing you which. List the candidates with `pgrep -fl '\''<pattern>'\''` (`pgrep -af` on Linux, where `-l` prints only the process name), options before the pattern, since anything after it is read as another pattern. Check that every listed process is one you mean to stop, then `kill <pid>`. These are blocked anywhere in the command, so text that only mentions them, such as a commit message or a grep pattern, is denied too: pass that text through a file."
  }
}'

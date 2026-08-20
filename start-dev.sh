#!/usr/bin/env bash
set -euo pipefail

# Starts the three local dev servers (backend, frontend, admin) each in its own
# tmux pane. A server is only started if nothing is already listening on its
# port, so re-running this script is safe.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="alliance"
WINDOW="dev"

names=(server   frontend      admin)
ports=(3005     5173          5174)
cmds=("bun run server:dev" "bun run frontend:dev" "bun run admin:dev")

# Shell snippet run inside a pane: start the server unless its port is taken,
# then drop to an interactive shell so the pane stays usable either way.
pane_cmd() {
  local name="$1" port="$2" cmd="$3"
  printf 'cd %q; if lsof -ti :%s -sTCP:LISTEN >/dev/null 2>&1; then echo "✓ %s already running on :%s — leaving it alone"; else echo "▶ starting %s on :%s"; %s; fi; exec "$SHELL"' \
    "$ROOT" "$port" "$name" "$port" "$name" "$port" "$cmd"
}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' already exists — attaching."
else
  # Pane 0: server
  tmux new-session -d -s "$SESSION" -n "$WINDOW" -c "$ROOT"
  tmux send-keys -t "$SESSION:$WINDOW" "$(pane_cmd "${names[0]}" "${ports[0]}" "${cmds[0]}")" C-m

  # Pane 1: frontend
  tmux split-window -t "$SESSION:$WINDOW" -c "$ROOT"
  tmux send-keys -t "$SESSION:$WINDOW" "$(pane_cmd "${names[1]}" "${ports[1]}" "${cmds[1]}")" C-m

  # Pane 2: admin
  tmux split-window -t "$SESSION:$WINDOW" -c "$ROOT"
  tmux send-keys -t "$SESSION:$WINDOW" "$(pane_cmd "${names[2]}" "${ports[2]}" "${cmds[2]}")" C-m

  tmux select-layout -t "$SESSION:$WINDOW" even-vertical
fi

# Attach (or switch, if already inside tmux).
if [ -n "${TMUX:-}" ]; then
  tmux switch-client -t "$SESSION"
else
  tmux attach-session -t "$SESSION"
fi

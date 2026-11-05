#!/usr/bin/env bash
set -euo pipefail

# Starts the three local dev servers (backend, frontend, admin) of the checkout
# the current directory is in, main or worktree, each in its own tmux pane, on
# that checkout's ports. A server is only started if nothing is already
# listening on its port, so re-running this script is safe.

ROOT="$(git rev-parse --show-toplevel)"
SESSION="$(basename "$ROOT")"
WINDOW="$SESSION"

# Assigned first because `eval "$(...)"` succeeds on empty output.
ports_env="$(cd "$ROOT" && bun scripts/ports.ts)"
eval "$ports_env"

# Postgres opens its port before crash recovery finishes.
if ! pg_isready -q -t 30; then
  echo "postgres not accepting connections after 30s — check /opt/homebrew/var/log/postgresql@17.log" >&2
  exit 1
fi

names=(server   frontend      admin)
ports=("$SERVER_PORT" "$FRONTEND_PORT" "$ADMIN_PORT")
cmds=("bun run server:dev" "bun run frontend:dev" "bun run admin:dev")

# Shell snippet run inside a pane: start the server unless its port is taken,
# then drop to an interactive shell so the pane stays usable either way.
pane_cmd() {
  local name="$1" port="$2" cmd="$3"
  printf 'cd %q; if lsof -ti :%s -sTCP:LISTEN >/dev/null 2>&1; then echo "✓ %s already running on :%s — leaving it alone"; else echo "▶ starting %s on :%s"; %s; fi; exec "$SHELL"' \
    "$ROOT" "$port" "$name" "$port" "$name" "$port" "$cmd"
}

fill_window() {
  local window="$1" pane i
  pane=$(tmux list-panes -t "$window" -F '#{pane_id}' | head -n1)
  for i in "${!names[@]}"; do
    if [ "$i" -gt 0 ]; then
      pane=$(tmux split-window -d -t "$pane" -c "$ROOT" -P -F '#{pane_id}')
    fi
    tmux send-keys -t "$pane" "$(pane_cmd "${names[$i]}" "${ports[$i]}" "${cmds[$i]}")" C-m
  done
  tmux select-layout -t "$window" even-horizontal
  style_window "$window"
}

slot_colours=(colour208 colour170 colour76 colour220 colour45 colour203 colour141 colour39)

# Slots are unique among live worktrees, so colouring by slot keeps concurrent
# worktrees apart.
style_window() {
  local window="$1" colour
  [ "$SLOT" -gt 0 ] || return 0
  colour="${slot_colours[(SLOT - 1) % ${#slot_colours[@]}]}"
  tmux set-option -w -t "$window" pane-border-style "fg=$colour"
  tmux set-option -w -t "$window" pane-active-border-style "fg=$colour,bold"
  tmux set-option -w -t "$window" window-status-style "fg=$colour"
  tmux set-option -w -t "$window" window-status-current-style "fg=$colour,bold"
}

if [ -n "${TMUX:-}" ]; then
  current=$(tmux display-message -p '#{session_id}')
  if tmux list-windows -t "$current" -F '#{window_name}' | grep -qxF "$WINDOW"; then
    echo "window '$WINDOW' already exists in this session — selecting it."
    tmux select-window -t "$current:$WINDOW"
  else
    fill_window "$(tmux new-window -t "$current" -n "$WINDOW" -c "$ROOT" -P -F '#{window_id}')"
  fi
elif tmux has-session -t "=$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' already exists — attaching."
  tmux attach-session -t "=$SESSION"
else
  fill_window "$(tmux new-session -d -s "$SESSION" -n "$WINDOW" -c "$ROOT" -P -F '#{window_id}')"
  tmux attach-session -t "=$SESSION"
fi

#!/usr/bin/env bash
set -euo pipefail

# Stops the dev servers tmux-launch.sh started for the checkout the current
# directory is in, then closes their tmux window. Servers it found already
# running, and so left outside tmux, are not touched.

ROOT="$(git rev-parse --show-toplevel)"
WINDOW="$(basename "$ROOT")"

# Skips this script's own subtree, which exists when it runs from one of the panes.
descendants() {
  local child
  for child in $(pgrep -P "$1" || true); do
    [ "$child" = "$$" ] && continue
    descendants "$child"
    echo "$child"
  done
}

windows=$(tmux list-windows -a -F '#{window_id} #{window_name}' 2>/dev/null | awk -v w="$WINDOW" '$2 == w { print $1 }')
if [ -z "$windows" ]; then
  echo "no tmux window '$WINDOW' — nothing to stop."
  exit 0
fi

pids=()
for window in $windows; do
  for pane_pid in $(tmux list-panes -t "$window" -F '#{pane_pid}'); do
    while read -r pid; do
      [ -n "$pid" ] && pids+=("$pid")
    done < <(descendants "$pane_pid")
  done
done

if [ "${#pids[@]}" -gt 0 ]; then
  echo "stopping ${#pids[@]} process(es): ${pids[*]}"
  kill -TERM "${pids[@]}" 2>/dev/null || true
  for _ in $(seq 1 100); do
    alive=()
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then alive+=("$pid"); fi
    done
    [ "${#alive[@]}" -eq 0 ] && break
    sleep 0.1
  done
  if [ "${#alive[@]}" -gt 0 ]; then
    echo "still running after 10s, sending SIGKILL: ${alive[*]}" >&2
    kill -KILL "${alive[@]}" 2>/dev/null || true
  fi
fi

for window in $windows; do
  tmux kill-window -t "$window"
done
echo "stopped '$WINDOW'."

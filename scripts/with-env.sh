#!/usr/bin/env bash
# Sources this checkout's worktree environment before running a command. With no
# arguments, prints the resolved ports and database names.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_root/.worktree/env"

if [[ -f "$env_file" ]]; then
  # shellcheck disable=SC1090
  source "$env_file"
fi

# The environment follows this script's path, while port discovery follows PWD.
# Run from elsewhere the two name different checkouts, and the command would get
# one checkout's database and URLs on another's ports — the collision this whole
# mechanism exists to prevent, so it fails rather than warns.
if [[ "$PWD" != "$repo_root" && "$PWD" != "$repo_root"/* ]]; then
  echo "error: $repo_root/scripts/with-env.sh run from $PWD" >&2
  echo "       ports resolve from the working directory; cd into the checkout first" >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  # Assign first so `set -e` sees a failure that `eval "$(...)"` would swallow.
  resolved="$(cd "$repo_root" && bun scripts/ports.ts)"
  eval "$resolved"

  echo "worktree:    ${ALLIANCE_WORKTREE:-<main checkout>} (slot $SLOT)"
  echo "server:      http://localhost:$SERVER_PORT"
  echo "frontend:    http://localhost:$FRONTEND_PORT"
  echo "admin:       http://localhost:$ADMIN_PORT"
  echo "metro:       http://localhost:$MOBILE_PORT"
  echo "database:    ${ALLIANCE_DB_NAME:-<server/.env>}"
  echo "test db:     ${TEST_DB_NAME:-<server/.env.test>}"
  exit 0
fi

exec "$@"

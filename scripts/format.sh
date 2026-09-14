#!/usr/bin/env bash
# Formats the whole repo, or only the paths passed as arguments.
#
#   bun run format                           # everything
#   bun run format apps/mobile/app.tsx       # only the named paths
#   bun run format:check apps/mobile/app.tsx # report without writing
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

mode=--write
if [[ "${1:-}" == --check ]]; then
  mode=--check
  shift
fi

for arg in "$@"; do
  if [[ "$arg" == -* ]]; then
    echo "format.sh: takes paths only, got $arg" >&2
    exit 2
  fi
done

exec ./node_modules/.bin/prettier "$mode" "${@:-.}"

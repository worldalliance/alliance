#!/usr/bin/env bash
# Runs each workspace's unit tests from inside that workspace, so its own
# bunfig.toml applies — the React packages preload a DOM there, and a bare
# `bun test` at the repo root skips that preload and fails every DOM test.
#
# CI runs each package back through this script, so the skip rule below is the
# same one locally and in CI. The package list is duplicated in the matrices in
# .github/workflows/ci.yaml — update both when adding a workspace.
#
#   scripts/test-all.sh              # every package below
#   scripts/test-all.sh apps/admin   # only the named packages
set -u

PACKAGES=(server common shared sharedweb apps/frontend apps/admin apps/mobile)

script_dir="$(cd "$(dirname "$0")" && pwd)" || exit 1
cd "$script_dir/.." || exit 1

if [ "$#" -gt 0 ]; then
  PACKAGES=("$@")
fi

failed=""

for pkg in "${PACKAGES[@]}"; do
  # A missing directory would otherwise reach the `find` below, come back empty,
  # and read as "no test files" — a green run covering nothing.
  if [ ! -d "$pkg" ]; then
    echo "==> $pkg — directory not found (stale package list?)"
    failed="$failed $pkg"
    continue
  fi

  # Mirrors bun test's discovery glob: **{.test,_test,.spec,_spec}.{js,ts,jsx,tsx}.
  # The separator before `test`/`spec` is either a dot or an underscore, so
  # `foo_test.ts` counts but `foo.e2e-spec.ts` does not — matching bun, which
  # leaves the server's `-spec.ts` e2e suites to `bun run test:e2e`.
  # No `pipefail` here — `grep -q` exits on its first match and leaves `find`
  # writing to a closed pipe, which would read as "no test files".
  if ! find "$pkg" -name node_modules -prune -o -type f -print |
    grep -Eq '[._](test|spec)\.(js|ts|jsx|tsx)$'; then
    echo "==> $pkg — no test files, skipping"
    continue
  fi

  echo "==> $pkg"
  (cd "$pkg" && bun test) || failed="$failed $pkg"
done

if [ -n "$failed" ]; then
  echo "FAILED:$failed"
  exit 1
fi

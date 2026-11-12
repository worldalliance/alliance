#!/usr/bin/env bash
# Runs each directory's unit tests from inside that directory, so its own
# bunfig.toml applies — the React packages preload a DOM there, and a bare
# `bun test` at the repo root skips that preload and fails every DOM test.
#
# CI runs each package back through this script, so the skip rule below is the
# same one locally and in CI. PACKAGES mirrors the test-unit matrices in
# .github/workflows/ci.yaml and deploy.yaml, so a new directory with tests goes
# in all three. The typecheck matrices in those two files list every package
# here except scripts, .github, agents/hooks and agents/skills, which have no
# tsconfig.
#
# agents/desktop installs from its own lockfile, which those matrices never
# install, so desktop.yaml runs its tests, and agents is listed here by
# subdirectory to leave agents/desktop out.
#
#   scripts/test-all.sh              # every package below
#   scripts/test-all.sh apps/admin   # only the named packages
set -u

PACKAGES=(server common kora-review shared sharedweb apps/frontend apps/admin apps/mobile scripts .github citesting agents/hooks agents/skills)

script_dir="$(cd "$(dirname "$0")" && pwd)" || exit 1
cd "$script_dir/.." || exit 1

# `git rebase --exec` and hooks export GIT_DIR, which would point the tests'
# fixture repos at this checkout.
# shellcheck disable=SC2046
unset $(git rev-parse --local-env-vars)

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

  # Mirrors bun test's discovery glob, which bun matches case-insensitively:
  # **{.test,_test,.spec,_spec}.{js,ts,jsx,tsx,mjs,cjs,mts,cts}.
  # The separator before `test`/`spec` is either a dot or an underscore, so
  # `foo_test.ts` counts but `foo.e2e-spec.ts` does not — matching bun, which
  # leaves the server's `-spec.ts` e2e suites to `bun run test:e2e`.
  # No `pipefail` here — `grep -q` exits on its first match and leaves `find`
  # writing to a closed pipe, which would read as "no test files".
  if ! find "$pkg" -name node_modules -prune -o -type f -print |
    grep -Eiq '[._](test|spec)\.([cm]?[jt]s|[jt]sx)$'; then
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

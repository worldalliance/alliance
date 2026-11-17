# Evidence

## Failure rate before the fix

Method: `bun test ./test/kora-batch-actions.e2e-spec.ts --timeout 50000 -t "retires a batch" --rerun-each 150` from `server/`, against the worktree's local test database, on `origin/main` at a48282832f, 2026-11-17, Bun from the repo's lockfile.

Result: 12 of 150 runs failed, all with an empty assignment after the retire: 3 at the B-filter assertion (rated transcript from B) and 9 at `toContain(rated)` (rated transcript from A, the other three from B).

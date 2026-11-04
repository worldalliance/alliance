# Evidence

## The incident, 2026-11-04 09:21

- The main checkout's `.git/config` had `[core] bare = true`; `git status` there failed with `fatal: this operation must be run in a work tree`, and `git worktree list` showed the checkout as `(bare)`.
- `.git/logs/refs/heads/main` shows five `commit: init` entries by `test <test@example.com>` moving `main` off `c795cebe5a`, followed by a reset back to it logged as "restore main after scripts tests wrote to the shared repo". `.git/worktrees/alliance-infisical/logs/HEAD` holds the same five commits, so they were made through that worktree.
- `test <test@example.com>` is the identity `scripts/lib/fixture-git.ts` gives fixture repos.
- `alliance-infisical` had a rebase in progress (`.git/worktrees/alliance-infisical/rebase-merge`, from 08:42). `agents/skills/review-loop/fixer-prompt.md` tells the fixer to run checks with `git rebase --exec '<checks>' <base>`.

## Reproductions (git 2.54.0, bun 1.3.6, macOS)

- In a worktree, `git rebase --exec 'env | grep ^GIT_'` prints `GIT_DIR=<repo>/.git/worktrees/<name>` and `GIT_PREFIX=`.
- With `GIT_DIR` set to a worktree's gitdir, a plain `git init` run in an unrelated directory re-initialises the shared repository and writes `core.bare = true` to its config; `git commit` there adds the commit to the worktree's branch. `git init --bare <dir>`, which names a directory, leaves the repository alone.
- In bun, deleting or adding a `process.env` entry (in a preload, a test, or a plain script) does not change the environment `node:child_process` or `Bun.spawnSync` hands a child that is given no `env`.
- In bun, a preload that throws fails the first test file and the remaining files still run under a bare `bun test` or any `--coverage` run; only `bun test <one file>` stops. `console.error` plus `process.exit(1)` stops all four modes.

## Second occurrence, 2026-11-04 10:06:53-10:07:30

A reviewer of this branch's first commit ran `bun run covercheck` with `GIT_DIR` set to the real repository's gitdir to test the preload. Its fixture tests ran anyway: `core.bare` became `true`, six `init` commits landed on `main`, about 70 fixture commits on the reviewer's branch, branches `foo` and `other` were created, and every record under `.git/alliance-worktrees/instances/` was deleted, leaving ten worktrees whose `alliance-instance` ids matched no record. covercheck spawns `bun test --coverage` directly, not through `test-all.sh`.

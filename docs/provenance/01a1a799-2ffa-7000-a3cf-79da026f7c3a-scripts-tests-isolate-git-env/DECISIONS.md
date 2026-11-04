# Decisions

## Cause

A `scripts/` test run under the review-loop fixer's `git rebase --exec` in the `alliance-infisical` worktree inherited `GIT_DIR`. The tests' git calls inherit the parent environment, so the fixtures' `git init` and commits hit the real repository (EVIDENCE.md).

## Fix

- Every entry point that runs tests drops git's repository-local variables (the list `git rev-parse --local-env-vars` prints, which git itself clears for submodules) from the environment it hands the tests: `scripts/test-all.sh`, behind `bun run test`, unsets them, and `scripts/covercheck.ts` spawns `bun test --coverage` with them removed. Checks under `rebase --exec` keep working, and every spawn site inside the tests is covered at once, where patching each helper would miss the next one added.
- `scripts/lib/git-env-guard.ts` exits the run when any of those variables is set. The root `bunfig.toml` and `scripts/bunfig.toml` preload it, which covers every test run from the repo root or `scripts/`, including one that runs git its own way; `scripts/lib/fixture-git.ts`, which every scripts test that runs git imports directly or through `worktree-fixture.ts`, imports it, which covers runs from any other directory, since bun reads only the bunfig in its working directory. It can't clear the variables, since bun children keep the original environment, and a thrown error fails only one test file while the rest still run (EVIDENCE.md).
- `gitLocalEnvVars()` throws on failure, like the rest of `scripts/lib/git.ts`, rather than returning a `Result`: `scripts/` doesn't depend on `@alliance/common`, and both callers want a loud exit.
- `scripts/git-env.test.ts` runs a two-file package of fixture tests under `GIT_DIR` through a bare `bun test`, `bun test --coverage`, `bun test <file>` from the repo root and from `scripts/`, with and without `fixture-git.ts`, `test-all.sh` and covercheck, and checks the outer repository keeps `core.bare = false` and its HEAD.

---
user: Charles Lien
task: Do ALL-2028, PR 3 of the Alliance agent desktop app plan: the agent session interface, event types and a scripted fake backend.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

## Root unit-test runs

- `citesting`'s tests ran in neither `scripts/test-all.sh`'s `PACKAGES` nor the `test-unit` matrices of `ci.yaml` and `deploy.yaml`, so all three list it, and `test-unit.yaml` installs Chromium for its browser tests (agent decision).
- `scripts/covercheck.ts` and `test-all.sh` match every extension `bun test` discovers, `.mjs`, `.cjs`, `.mts` and `.cts` included (agent decision).
- `scripts/test-all.test.ts` fails on any tracked file `bun test` would discover outside `PACKAGES` so a package's tests can't drop out of `bun run test` silently; it checks `PACKAGES` only, and ALL-2064 covers checking the matrices. It shares the `PACKAGES` parse and the discovery rule with `covercheck` through `scripts/lib/test-packages.ts` (agent decision).
- The lists name `agents/hooks` rather than `agents`, so the app's `*.test.ts` unit tests, which need the app's own install, stay out of runs that install only the root lockfile. This replaces the spec's choice to keep listing `agents` until the app's first test `bun test` discovers (agent decision).

## `Result` copy

The app keeps its own copy of `common/src/result.ts` at `agents/desktop/src/main/result.ts`, its doc example importing from the copy. The root `AGENTS.md`'s `Result` rule points at the copy so the two change together. That pointer joins the spec's list of edits outside `agents/desktop` under Location, so removing the app reverts it, and `agents/README.md`'s removal note names the provenance directories that build on the spec beside the spec itself (agent decision).

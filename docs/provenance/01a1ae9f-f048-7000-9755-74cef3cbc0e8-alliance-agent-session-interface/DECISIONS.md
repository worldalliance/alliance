---
user: Charles Lien
task: Do ALL-2028, PR 3 of the Alliance agent desktop app plan: the agent session interface, event types and a scripted fake backend.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

## Root unit-test runs

- `citesting`'s tests ran in neither `scripts/test-all.sh`'s `PACKAGES` nor the `test-unit` matrices of `ci.yaml` and `deploy.yaml`, so all three list it, and `test-unit.yaml` installs Chromium for its browser tests (agent decision).
- `scripts/covercheck.ts` and `test-all.sh` match every extension `bun test` discovers, `.mjs`, `.cjs`, `.mts` and `.cts` included (agent decision).
- `scripts/test-all.test.ts` fails on any tracked file `bun test` would discover outside `PACKAGES` so a package's tests can't drop out of `bun run test` silently; it checks `PACKAGES` only, and ALL-2064 covers checking the matrices. It shares the `PACKAGES` parse and the discovery rule with `covercheck` through `scripts/lib/test-packages.ts` (agent decision).
- The lists name `agents/hooks` rather than `agents`, so the app's `*.test.ts` unit tests stay out of runs that install only the root lockfile, and `desktop.yaml`, which installs the app's, runs them. This replaces the spec's choice to keep listing `agents` until the app's first test `bun test` discovers (agent decision).

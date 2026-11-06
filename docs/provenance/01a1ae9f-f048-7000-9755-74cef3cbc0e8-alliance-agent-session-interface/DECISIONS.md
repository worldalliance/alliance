---
user: Charles Lien
task: Do ALL-2028, PR 3 of the Alliance agent desktop app plan: the agent session interface, event types and a scripted fake backend.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

## Root unit-test runs

- `citesting`'s tests ran in neither `scripts/test-all.sh`'s `PACKAGES` nor the `test-unit` matrices of `ci.yaml` and `deploy.yaml`, so all three list it, and `test-unit.yaml` installs Chromium for its browser tests (agent decision).

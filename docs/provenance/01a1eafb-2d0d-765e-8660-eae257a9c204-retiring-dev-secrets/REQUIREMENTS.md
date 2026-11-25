---
user: Charles Lien
task: Fix ALL-2159 (removing a dev secret turns the parameter-drift check red until the parameter is deleted) and open a PR for it.
---

# Requirements

- Removing a dev secret keeps the `parameter-drift` check green at every step. Origin: user-originated (ALL-2159).
- Each consumer in `scripts/dev-secrets.json` may have an optional `retiring` list. The drift check allows a `retiring` key in `/alliance/dev/<consumer>/` without requiring it; `scripts/with-secrets.sh` neither requires nor exports it. Origin: proposed in ALL-2159, user-approved.
- Removal becomes: move the key to `retiring` and merge; delete the parameter; drop it from `retiring`. The removal steps in `docs/local-secrets.md` say so. Origin: proposed in ALL-2159, user-approved.
- Tests in `scripts/check-parameter-drift.test.ts` and `scripts/with-secrets.test.ts` cover the `retiring` list. Origin: proposed in ALL-2159, user-approved.

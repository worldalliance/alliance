---
user: Charles Lien
task: Do ALL-2025 (run the nightly prod → staging sync on Parameter Store instead of db-sync.env) and open a PR.
---

# Requirements

1. The nightly prod → staging sync reads its secrets from AWS SSM Parameter Store, through the staging host's instance role, instead of the hand-maintained `/home/ec2-user/db-sync.env` on the staging host. (Linear issue ALL-2025, user-approved.)
2. `db-sync.env` is deleted from the staging host once a nightly run succeeds on Parameter Store. `docs/backend-secrets.md` describes the new setup. (Linear issue ALL-2025, user-approved.)
3. Open a PR for the change. (User-originated.)
4. Rollout order: the PR opens first; the Terraform grant is applied and the seven `/alliance/staging/db-sync/` parameters are created after the PR's review and before it merges; `db-sync.env` is deleted only after a nightly run succeeds on Parameter Store. (User-originated.)

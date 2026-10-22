---
user: Charles Lien
task: A CI check for whether `citesting/scripts/reseed.sh` needs to run
---

## User request

- The user asked for "a ci test to check whether we need to run reseed.sh", and maybe "an automatic PR creation for when we do", unsure which was better, and asked what the options were.

## Trigger

- The check runs on anything pushed to `main` and on every PR. When the agent asked whether "every PR" meant PRs into any branch or only into `main`/`production`, the user chose PRs into `main`/`production`.

## Approval of agent proposals

The user said "go with your recommendation" or "recommended" to each of these agent-authored proposals:

- Of three agent-listed options (A: a check that fails the PR and tells the author to run `reseed.sh`; B: the check plus a job that commits a fresh dump to the PR; C: an auto-PR after merge to `main`), option A.
- Fail only when the dump fails to load after all migrations, not when `seed_migration_timestamp.txt` is behind the newest migration.
- Run the same seeding as the screenshot runner, `seedDatabase()` from `citesting/src/seed-database.ts`, including its timestamp shift.
- Make the check a required status check on `main` (branch protection, set by hand after merge).
- On failure, print an `::error::` annotation naming `citesting/scripts/reseed.sh` and pointing at its `--help` for `--revert`.
- Run on PRs into both `main` and `production`.
- A separate workflow and job from `migrations-drift-check`.
- A standalone workflow with its own `pull_request` and `push` triggers, not called from `ci.yaml`.
- On a failed push to `main`, only the red check on the commit; no Slack notification.
- No `push` trigger for `production`.
- Out of scope: changes to `reseed.sh` (such as detecting its revert miscount), options B and C, changes to the seed's contents, and the mobile visual regression workflows.

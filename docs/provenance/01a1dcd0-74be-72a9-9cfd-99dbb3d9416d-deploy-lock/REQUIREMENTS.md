---
user: Charles Lien
task: Work on the next issue of the Faster CI deploys Linear project, ALL-2164 (run deploy checks outside the lock, with one lock over deploy and smoke checks), and open its PR from the `ci` branch.
---

# Requirements

This is the third PR planned by `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. The requirements below come from that task's "Deploy concurrency" section, where the user approved them; the origin labels are carried from there.

- **Checks run without any lock** (approved, research recommendation).
- **One per-environment lock covers the deploy and smoke-check steps together** (approved, research recommendation).
- **The lock uses `queue: max` and is never cancelled in progress**; `cancel-in-progress` is not used (approved, research recommendation).
- **A deploy judges whether it is stale when it acquires the lock** (approved, agent proposal).
- **A staging deploy skips itself only when a strictly newer commit has already deployed to staging** (approved, agent proposal):
  - A newer commit that is merely queued doesn't make it skip, so in-order runs all deploy.
  - When the same commit is already deployed, which only a re-run reaches, the deploy redeploys and re-runs the smoke checks under the lock, and the commit stays promotable.
  - Once a newer commit has deployed, re-running an older commit's staging run still leaves that commit unpromotable.
- **A production deploy skips itself if its commit is no longer the newest for production** (approved, research recommendation).
- **The work ships as a PR from the `ci` branch** (user).

---
user: Charles Lien
task: Implement ALL-2367, the first of three PRs ALL-2236 is split into, on this branch, and open its PR.
---

# Requirements

This is the first PR of the plan in `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks`.

1. Fix the cron jobs that hold a pooled database connection for their lock while they take more connections from the same pool. The hotfix that raised the pool size stays in place. (User-originated; restated from 01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.)
2. The server will eventually run as more than one process. The fix must not need rewriting when that happens. (User-originated; restated from 01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.)
3. ALL-2236 lands as three PRs, one per sub-issue: a Postgres lease store with no cron using it (ALL-2367), then the cutover of the cron jobs to leases (ALL-2368), then a pool resize (ALL-2369). (Agent-proposed, user-approved.)
4. This PR adds `@nestjs/locks`, pinned to `0.0.6`, plus a lease table with its migration and a Postgres `LockStore`. Acquire, renew and release are each one statement that returns its connection at once, with expiry measured on the database's clock. No cron job changes how it locks. (ALL-2367-proposed, user-approved.)
5. Before any cron uses the store, the package's store-contract suite passes against real Postgres with its concurrency cases, and two separate bun processes racing for one key leave exactly one winner per round, with fencing tokens that grow. If the package can't be made reliable here, fall back to our own lease helper on the same table. (ALL-2367-proposed, user-approved.)

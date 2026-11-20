---
user: Charles Lien
task: Implement ALL-2368, the second of three PRs ALL-2236 is split into, on the cron-jobs branch rebased on origin/main, and open its PR.
---

# Requirements

This is the second PR of the plan in `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks`, after `docs/provenance/01a1f4e9-c1af-70ad-9c94-a205cbe33ef4-cron-lease-store`.

1. Fix the cron jobs that hold a pooled database connection for their lock while they take more connections from the same pool. The hotfix that raised the pool size stays in place. (User-originated; restated from 01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.)
2. The server will eventually run as more than one process. The fix must not need rewriting when that happens. (User-originated; restated from 01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.)
3. ALL-2236 lands as three PRs, one per sub-issue: a Postgres lease store with no cron using it (ALL-2367), then the cutover of the cron jobs to leases (ALL-2368), then a pool resize (ALL-2369). (Agent-proposed, user-approved; restated from 01a1f4e9-c1af-70ad-9c94-a205cbe33ef4-cron-lease-store.)
4. The 11 cron jobs on `withPgSessionLock` / `withPgAdvisoryLock` move to a per-run lease that skips on contention, as they skip today, and `server/src/notifs/lock-utils.ts` and `server/src/notifs/lock-keys.ts` are deleted. (ALL-2368-proposed, user-approved.)
5. Every leased job stops taking new items once its lease is lost. Outside calls keep their own time limits. (ALL-2368-proposed, user-approved.)
6. Leases start at 60 seconds, renewed every 20 seconds, to be tuned later from measured renewal latency. (ALL-2368-proposed, user-approved.)
7. Five crons that take no lock today get a lease: daily stats, per-action stats, the action stat recount (`ActionStatsService.computeAllActionStats`), ambassador invite-goal notifications and the Twilio status poll. The PostHog time-spent refresh keeps running in every process. `logDivergences` may drop its lock. (ALL-2368-proposed, user-approved.)
8. `server/src/main.ts` calls `enableShutdownHooks()` so leases are released on shutdown. (ALL-2368-proposed, user-approved.)
9. Startup on staging fails unless the Postgres lease store is registered. (ALL-2368-proposed, user-approved.)
10. Done when: with the pool set smaller than the number of cron jobs in a test, all jobs firing together complete, and no connection stays checked out for a lock while a job runs. (ALL-2368-proposed, user-approved.)
11. This PR merges to `main` only after the overlap-hardening PRs (#1027, #1030, #1037) and the lease table's migration (#1039) are live in production, so the cutover never ships to production in the same deploy as them. (Agent-proposed, user-approved.)

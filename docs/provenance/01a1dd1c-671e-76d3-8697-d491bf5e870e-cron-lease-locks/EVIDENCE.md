# Evidence

Research by four subagents on 2026-11-14 and 2026-11-15 UTC: a claude subagent and an independent codex subagent on established practice, then codex second opinions on the design questions. No formal standard or published research covers this design; sources are vendor documentation and the behaviour of maintained libraries. Status labels follow the root `AGENTS.md` **Established practice**. The readings of this repository's code were made at commit `8214d88b7e`, whose `server/` matches `fd43f35d66` on `main`.

## Pool locking

- HikariCP, "About Pool Sizing" (vendor recommendation): holding connections while acquiring more is "largely an application-level issue", and "we would urge you to examine first what can be done at the application level before enlarging the pool." The minimum pool size that avoids deadlock is `Tn x (Cm - 1) + 1`, for `Tn` concurrent actors each holding at most `Cm` connections. https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
- node-postgres pool (vendor recommendation): `max` defaults to 10 and `connectionTimeoutMillis` to 0, "which means no timeout"; with clients not returned, further checkouts "hang indefinitely". The pool exposes `totalCount`, `idleCount` and `waitingCount`. https://node-postgres.com/apis/pool
- TypeORM 0.3.28 (read from installed source, `driver/postgres/PostgresDriver.js`): `poolSize` maps to `max`, `connectTimeoutMS` to `connectionTimeoutMillis`, and `extra` is spread over both; an acquire timeout is rethrown without a retry.

## Session advisory locks and poolers

- PostgreSQL, "Advisory Locks" (vendor recommendation): a session-level lock "is held until explicitly released or the session ends" and does not follow transaction rollback; a transaction-level lock is released at transaction end. https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS
- PgBouncer feature table (vendor recommendation): session-level advisory locks are supported in session pooling and never in transaction pooling. https://www.pgbouncer.org/features.html
- RDS Proxy (vendor recommendation): it pins the connection on `pg_advisory_lock` and `pg_try_advisory_lock`, and not on transaction-level advisory locks. https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html

## Lease rows and alternatives

- NestJS, "Locks" (vendor recommendation): it avoids session advisory locks because "an advisory lock is bound to a session, so the holder would have to keep one connection checked out of the pool", and uses a row with a key, owner, fencing token and expiry; the lease defaults to 30 seconds and renews every third of that. The page includes a TypeORM store recipe. https://docs.nestjs.com/reliability/locks
- ShedLock (common practice): a lock row with `lockAtMostFor`; a node that finds the lock held skips the run; it assumes synchronized clocks. https://github.com/lukas-krecan/ShedLock
- NestJS scheduling (vendor recommendation): `waitForCompletion` skips a tick while the previous run is unfinished, and "the scheduler runs every job in every process of your application". https://docs.nestjs.com/techniques/task-scheduling
- pg-boss and graphile-worker (common practice): both schedule from crontabs at one-minute granularity. https://pgboss.io/api/scheduling, https://worker.graphile.org/docs/cron

## `@nestjs/locks`

Read from the npm registry and the 0.0.6 tarball by the codex subagent, and the registry entry checked again by the agent, 2026-11-15.

- First published 2026-09-25; six versions; 0.0.6 published 2026-11-06. Peers: `@nestjs/common` and `@nestjs/core` 11 or 12. Repository `nestjs/locks`.
- It renews at about a third of the lease, treats a late store reply as a loss, releases on shutdown, and exposes a loss signal to the callback. `WithoutOverlapping` takes a lease per run and skips on contention. It does not stop a callback whose lease is lost.
- Only an in-memory store ships. Startup refuses it when `NODE_ENV === 'production'` only. A store-contract test suite ships in `dist/testing`.
- Not verified: the package under bun with this repo's NestJS and `@nestjs/schedule` versions, and whether its upstream tests pass.

## Connections per locked job

Static reading of each caller of `withPgSessionLock` and `withPgAdvisoryLock` by the codex subagent, 2026-11-14; lower bounds, not measured peaks. Every callback ignores the lock's query runner. Two connections (lock plus one sequential query): contract reminders, waitlist emails, MMS media copy. Three or more through parallel queries: action-event notifications, contract suspensions, recognition delivery, task badges (at least 3); cohort decisions and divergence logging (at least 4); forum autocomplete and the participant-count reload (at least 5).

## Unlocked crons

Static reading of all 25 `@Cron` methods in `server/src` by the codex subagent, 2026-11-15: 11 take a lock, 14 do not.

- A concurrent double run does harm: `AnalyticsService.calculateDailyStats` and `ActionStatsAnalyticsService.calculateActionStats` (read-then-insert races a unique constraint: the losing daily-stats run fails its insert, and the per-action run aborts its loop over actions), `ActionStatsService.computeAllActionStats` (an older count can overwrite a newer one), `AmbassadorInviteGoalService.sendDueAmbassadorInviteGoalNotifications` (check-then-send creates duplicate notifications), `TwilioStatusWorker.processTwilioStatus` (duplicate failure events and Slack messages).
- Safe: `NotifPushDispatcherWorker.dispatchPushes` (claims rows with `FOR UPDATE SKIP LOCKED`), `ActionUpdateRecognitionWorker.prepareDue` (row lock and marker), `PushService.queryExpoStatuses`, `KoraParticipantService.forgetExpiredSignups`, and the four `forgetExpired` clean-ups (spent tokens, waitlist browsers, Kora sessions, OTP).
- Must run in every process: `PosthogTimeSpentService.getTimeSpentFromPosthog`, which fills arrays held on the service instance.

## Overlap per locked job

Static reading by the codex subagent, 2026-11-15, of what a second concurrent run would do today.

- Contract reminders: both runs can select the same user and both send; the "sent" mark is an unconditional update.
- Forum autocomplete: duplicate completion activities, events and Slack messages, or an "already exists" error that aborts the pass.
- Contract suspensions: the unique event stops a second suspension, but the loser's community work and leader notifications have already started.
- Action-event notifications: the same reminder group is not sent twice, but two runs can send sibling groups about the same tasks.
- Waitlist emails: the row claim prevents a double send; a new run marks the other run's in-flight email uncertain, and the old run can overwrite that.
- Recognition delivery: row claims partition batches; after a claim's ten-minute expiry a paused worker can resume beside a new claimant and both send.
- Task badges and the participant-count reload: an older result can overwrite a newer one until the next run repairs it.
- Cohort decisions: redundant work; the unique insert keeps the first writer. MMS media copy: duplicate downloads; the stored key is protected by a compare-and-set. Divergence logging: duplicate log lines.

## Monitoring

- Measured on the production host, 2026-11-15, from the API's own `http_request_duration_seconds_count` for the `/metrics` route and the process start time pm2 reports: 185 requests in the 46 minutes since its restart, one every 15 seconds, matching the scrape interval in `docs/legacy/monitoring.md`. Whether Grafana has alert rules or a notification channel is not known.
- `GET /` returns a constant and `scripts/deploy_backend.sh` polls it to decide whether a deploy succeeded (read from the repository).
- Prometheus (vendor recommendation): the `up` series records whether each scrape succeeded. https://prometheus.io/docs/concepts/jobs_instances/
- Grafana (vendor recommendation): alert rules, contact points and notification policies can be provisioned from version-controlled files, and Slack is a supported contact point. https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/

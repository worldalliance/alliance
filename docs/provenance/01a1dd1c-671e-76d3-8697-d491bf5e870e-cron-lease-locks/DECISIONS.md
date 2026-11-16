# Decisions

The user deferred all seven design questions, so each choice below is the agent's and a later agent may change one that causes friction, within REQUIREMENTS.md. What the user deferred is how the work is done, not whether it happens. Each was put to an independent second opinion (a codex subagent given the options unranked); where it differed from the agent's first recommendation, that is noted. Sources are in EVIDENCE.md.

## 1. One run at a time through expiring lease rows, with `@nestjs/locks`

Replace the session advisory locks in `server/src/notifs/lock-utils.ts` with lease rows in a table: taking, renewing and releasing a lease are single short statements, so no connection is held while a job runs. Use `@nestjs/locks`, pinned to the version reviewed, with a Postgres `LockStore` and migration written here, since the package ships only an in-memory store. Lease SQL uses the database's clock. The second opinion agreed.

- Why not keep advisory locks on a separate pool, or run each job on its lock's connection: both keep session advisory locks, which a transaction-mode pooler does not support and RDS Proxy pins a connection for (EVIDENCE.md, "Session advisory locks and poolers"), and REQUIREMENTS.md 2 makes a pooler likely. Running jobs on the lock's connection also depends on every query under a job using that one connection, which nothing enforces; several jobs fan out to 3 to 5 connections today (EVIDENCE.md, "Connections per locked job").
- Why not an in-process guard (`waitForCompletion`): it protects only within one process, against REQUIREMENTS.md 2.
- Why not a job queue (pg-boss, graphile-worker): their schedules have one-minute granularity, and two crons here run every 10 and 30 seconds; a queue also changes retry and backlog behaviour per job. Reconsider it if durable retries become a requirement.
- Why a package over our own helper: the root `AGENTS.md` prefers a maintained package, and renewal, late replies and shutdown are the parts easiest to get wrong. The package is young (EVIDENCE.md, "`@nestjs/locks`"), so the store runs the package's store-contract suite against real Postgres, and two-process contention tests run under bun before cutover. If those can't be made reliable, fall back to our own lease helper on the same table.
- `withPgAdvisoryLock`'s transaction wraps none of a job's work (the callbacks query on other connections), so it goes with the helper.
- `server/src/main.ts` does not call `enableShutdownHooks()`; the cutover adds it so leases are released on shutdown.
- Staging needs its own startup check that the Postgres store is registered: the package's guard against the in-memory store tests only `NODE_ENV === 'production'`.

## 2. Lock the crons where a double run does harm; leave the rest

Of the 14 crons that take no lock today (EVIDENCE.md, "Unlocked crons"), five get a lease: daily stats, per-action stats, the action stat recount, ambassador invite-goal notifications and the Twilio status poll. Eight stay unlocked because they are already safe. The PostHog time-spent refresh must run in every process, since it fills a per-process cache, so it never takes a cross-process lease. `logDivergences` only reads and logs, so it may drop its lock. The second opinion agreed, and its audit is the basis for the list.

A lease does not replace conflict-safe writes: the two stats crons also get an upsert in place of read-then-insert, and the invite-goal notification a durable per-goal dedup.

## 3. Leases renew while a job runs

A short expiry renewed from a heartbeat, so a crashed process frees its lease quickly and a healthy long job keeps it. Start from a 60-second lease renewed every 20 seconds and tune from measured renewal latency; these numbers are a starting point, not researched values. The second opinion agreed and added what the heartbeat does not cover, which decision 6 takes up: a job must stop taking new items once its lease is lost, and outside calls need their own time limits, since a hung provider call keeps the heartbeat alive.

## 4. Pool-exhaustion detection is part of this work

Export the application pool's total, idle and waiting counts and a count of acquire timeouts as Prometheus metrics, read from the pool the app's `DataSource` uses. Add a separate database-readiness endpoint that runs a bounded `SELECT 1` through the application pool. `GET /` keeps answering without the database: `scripts/deploy_backend.sh` and the deploy workflow use it to decide whether a deploy succeeded, so making it depend on the database would change rollback behaviour. The second opinion agreed.

## 5. The hotfix review's two leftovers are fixed here

The test asserts the options on the `DataSource` the app builds, and the `poolSize` comment states the real threshold. The pool stays at 30 with the 10-second acquire timeout until the metrics from decision 4 give a reason to change it. HikariCP's deadlock minimum (EVIDENCE.md, "Pool locking") is one more than the sum over jobs of the connections each holds while waiting for another; with the per-job lower bounds in EVIDENCE.md, "Connections per locked job", that is at least 26 for the 11 locked jobs. So 30 clears it by at most 4, before requests and the unlocked crons, and only the cutover in decision 1 removes the dependence on that margin. The second opinion agreed.

## 6. Every harmful overlap is closed before the cutover to leases

The agent first recommended hardening only the jobs that send to members, reasoning that a lease is no weaker than today's advisory lock. The second opinion showed that reasoning is wrong: a lease can be taken over while the old process and its database session are still alive, after an event-loop pause or a renewal that waits on a busy pool, which an advisory lock does not allow. The comparison is reasoning from how each lock is held (EVIDENCE.md, "Session advisory locks and poolers" and "`@nestjs/locks`"), not a measured result:

| Event | Session advisory lock | Renewed lease |
| --- | --- | --- |
| Process or event-loop pause, database session alive | Lock stays held | Renewal stops; after expiry another run takes over, and the paused callback can resume |
| Application pool saturated | Lock stays held | A renewal waiting on the pool can miss its deadline |
| Database session ends | Lock is released; the callback is not told and carries on | Renewal fails; takeover after expiry |
| Clock step | No effect | Changes the takeover window unless expiry uses database time |

So the cutover widens the overlap window, and the decision follows the second opinion: each of the 11 locked jobs gets an overlap-safety argument, and those where an overlap does harm are fixed first, while still on advisory locks. EVIDENCE.md, "Overlap per locked job" has the per-job findings; in short:

- Fix: contract reminders (atomic conditional claim per user with an attempt owner), forum autocomplete (atomic create-if-absent; side effects only for the winner), contract suspensions (commit the winning transition before outside effects), action-event notifications (reserve coverage per recipient before sending), waitlist emails and recognition delivery (attempt owners; a new run must not treat another run's in-flight send as dead), task badges and the participant-count reload (guard writes against a superseded run).
- Leave: cohort decisions (unique insert, first writer wins), MMS media copy (existing compare-and-set), divergence logging.
- Every job stops taking new items once its lease is lost.
- A send that may have reached the provider stays "uncertain" and is not retried automatically. This keeps what the waitlist sender and MMS late-send handling do today (reconstructed from existing code; the user has stated no policy on duplicate versus missed sends).

## 7. Alerts come from Grafana on the Prometheus data, to Slack

The agent's first recommendation was to ask what monitoring exists; the user deferred, and the second opinion picked Grafana alerts, which this follows. Prometheus already scrapes the API every 15 seconds (EVIDENCE.md, "Monitoring"). Alert rules, the Slack contact point and the Prometheus and Grafana configuration move into the repository and are provisioned from files, since today they exist only on the monitoring host, set up by hand from `docs/legacy/monitoring.md`. Starting rules: pool waiters above zero for a minute, three or more acquire timeouts in two minutes, the API scrape failing for a minute, and the readiness endpoint failing twice in a row. The work is done when a test alert has reached Slack.

Not chosen: the server posting to Slack itself. It can't report when it is hung or dead, and its existing Slack path (`EventLogService`) writes to the database first, so it fails with the pool.

Needed from the user at implementation time: access to the monitoring host, and which Slack channel takes the alerts. An uptime check outside both hosts would cover the monitoring host failing too; it is noted, not planned here.

## Order of work

Each step is its own PR and task directory naming this one.

1. Detection (decision 4), the hotfix leftovers (decision 5), and the monitoring configuration and alerts (decision 7). Independent of the rest, and it makes the later steps observable.
2. Overlap hardening on the existing advisory locks (decision 6), and conflict-safe writes for the five crons gaining a lock (decision 2).
3. The lease table, store and package, behind tests; then the cutover of the locked jobs and the five new ones, and removal of `lock-utils.ts`.

The cutover relies on deploys stopping the old process before starting the new one (`scripts/deploy_backend.sh`), because advisory locks and lease rows do not see each other. The lease table's migration ships before the code that uses it, per the root `AGENTS.md` **Breaking changes**.

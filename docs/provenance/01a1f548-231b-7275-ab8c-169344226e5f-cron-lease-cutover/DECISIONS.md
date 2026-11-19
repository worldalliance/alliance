# Decisions

All agent decisions. Decisions 1–3 of `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/DECISIONS.md` hold the design, and `docs/provenance/01a1f4e9-c1af-70ad-9c94-a205cbe33ef4-cron-lease-store/DECISIONS.md` the store. These are the choices made while cutting the jobs over.

## 1. Release on shutdown is best effort; pm2's kill timeout stays at its default

`deploy_backend.sh` stops the backend with `pm2 delete` and starts the new release only after, so pm2's default 1.6 s kill timeout bounds the deploy's downtime. `@nestjs/locks` releases held leases in `beforeApplicationShutdown`, after the `onModuleDestroy` hooks and before Nest closes the servers; a release those hooks delay past the kill never happens, and the new process skips that cron until the lease expires, within the lease's ttl. Raising the kill timeout would trade API downtime on every deploy for at most one skipped tick per cron, so it stays.

The hooks listen only for SIGINT, pm2's stop signal, and SIGTERM, the conventional one: with no arguments Nest also listens for SIGSEGV, SIGBUS, SIGFPE and SIGILL, on which Node documents that running JS listeners is unsafe.

Shutdown hooks also make the existing listener drains (task badges, cohort decisions, contract reinstated, message push, both messaging gateways) and the PostHog flush run on SIGINT or SIGTERM, which they did not before. The drains detach their listeners and wait, and PostHog flushes, in `onApplicationShutdown`, which Nest 11 runs after `dispose()` has closed Socket.IO and HTTP and waited for in-flight requests, and before the global TypeORM and EventEmitter modules close the pool and drop every listener. A request in flight at shutdown so keeps its side effects, such as a message's push notification, and a new one is refused at the connection rather than accepted without them. PostHog's module is global, so Nest runs its flush after the drains, and it sends what in-flight requests and drains captured. Under Bun, `server.close()` waits for a keep-alive connection's idle timeout, about 6 s after its last response, so `configureApp` closes idle connections after each response once the server has stopped listening; close then resolves as the last in-flight response finishes. Under Bun, `test/shutdown-drain.e2e-spec.ts` checks that a request in flight when shutdown starts still gets its listener's work done, and that close resolves within 1 s of the response (EVIDENCE.md, "Shutdown under Bun"). pm2's 1.6 s kill can still cut a drain or an in-flight request short, as it could before this task. This order is an agent decision; the user was not asked.

## 2. The startup check runs in every environment

`LeaseModule.onModuleInit` throws unless `LocksStorage.source` is `PgLockStore`. REQUIREMENTS.md 9 names staging; checking everywhere covers staging and also fails a local or test boot that lost the store, which would otherwise run on the in-memory store silently.

## 3. The module ttl is 60 s

`LocksModule.forRoot({ ttl: "60s" })` sets every lease to REQUIREMENTS.md 6's starting point, renewed every 20 s by the package. No renewal-latency measurement exists yet to tune it from.

## 4. Every e2e test app loads `LeaseModule`

A decorated method called on an instance `LocksModule` doesn't know throws, and many specs call cron entry points. `createTestApp` imports `LeaseModule`, so those calls take real leases on the test database. `createTestApp` and `testConnectionOptions` take a `poolSize` for the pool test.

`createTestApp` builds the schema once, when the DataSource connects with `testConnectionOptions`' `dropSchema` and `synchronize`, and no longer drops and rebuilds it after `app.listen()`: an app importing `ScheduleModule` starts its crons at listen, and they failed against the half-built schema. Test apps now keep the triggers `LegacyDeletedFlagService` installs on `post` and `comment` at bootstrap, which the second drop removed with their tables, as production does.

## 5. The package's `@WithoutOverlapping({ key })`, not a hand-written wrapper

It is the package's per-run lease that skips on contention (REQUIREMENTS.md 4): it renews every `ttl / 3`, fails closed when the store errors or times out (`storeTimeout`, 10 s by default), releases at shutdown, and puts the run's signal in `LocksContext`. A wrapper around `Locks.acquire` would repeat that. Its skips log at `debug` where the advisory-lock wrappers logged "skipped bc of lock" at `log`; the old lines were noise on every overlapping tick, so the package's level stands.

Every decorator sets an explicit `key` from the `CronLease` enum (`server/src/leases/cron-lease.ts`), since the default key is the class and method name, which a rename changes. The package rejects two jobs on one key unless both set it.

## 6. A lost lease stops the run through `assertLeaseHeld()` at each item

`LocksContext` reads a module-level `AsyncLocalStorage`, so `assertLeaseHeld()` (`server/src/leases/cron-lease.ts`) can check the run's signal from any service the job calls, with no constructor changes. It throws the signal's reason (a `LockLostError`) at the start of each item: a member, plan, candidate, action, recipient, recognition batch, MMS item or queued message. Outside a leased run it does nothing, so tests, webhooks and the admin endpoint that call the same code are unaffected. The item already started finishes; the overlap hardening in ALL-2235 is what keeps that item safe against a run that took over.

Where a job has no loop of items, nothing checks: daily stats (one insert, `orIgnore`), per-action stats and the participant-count reload (one publish, fenced by its computation). Invite-goal notifications send in parallel, so the check sits once before the sends.

## 7. Cron entry points that others call directly stay unleased

The leased method is the one `@nestjs/schedule` calls. Where tests or other code call the job's method directly, the cron gets a thin leased entry point (`…OnSchedule`) and the method stays unleased: daily stats, per-action stats (also called by the admin endpoint in `analytics.controller.ts`), invite-goal notifications and the Twilio poll. The overlap tests of ALL-2239 run those methods twice at once to prove the writes are conflict-safe; behind a lease, the second run would skip and the tests would prove nothing.

The waitlist sender's `run()` is called fire-and-forget by `WaitlistEmailService` and documents that it never rejects. A decorated method rejects when the store fails, so `run()` stays undecorated and catches, and calls a decorated private `sendDueLeased()`.

## 8. `logDivergences` drops its lock

It only reads and logs (REQUIREMENTS.md 7 allows dropping it). Unleased, two processes would both log the same divergences.

## 9. `pool-options.spec.ts` loses its lock-based assertion here

The assertion computed the deadlock minimum from `LOCK_KEYS`, which this PR deletes, and the formula no longer applies once no job holds a connection for its lock. The pool stays at 30, with a comment pointing at ALL-2369, which sizes it from production metrics. This takes the "drop the spec's lock-based assertion and the `poolSize` comment" part of ALL-2369's scope, because deleting `lock-keys.ts` forces it.

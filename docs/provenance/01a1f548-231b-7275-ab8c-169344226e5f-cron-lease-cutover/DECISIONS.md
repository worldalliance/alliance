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

A decorated method called on an instance `LocksModule` doesn't know throws, and many specs call cron entry points. `createTestApp` imports `LeaseModule`, so those calls take real leases on the test database.

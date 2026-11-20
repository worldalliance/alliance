# Evidence

## `@nestjs/locks` 0.0.6 behaviour

Read from the installed package's `dist/` on 2026-11-19.

- `@WithoutOverlapping()` wraps the method; a call on an instance `LocksModule` did not register throws (`utils/job-decorator.util.js`). Registration scans every provider's prototype methods, not only `@Cron` ones (`services/scheduled-jobs.service.js`, `onModuleInit`).
- A skip logs at `debug` and emits `job-skipped`; a store failure throws `"<job> did not run: the lock store failed"` (fail closed); the run lock is released in `finally` (`services/scheduled-jobs.service.js`, `runner`).
- `LocksContext` reads a module-level `AsyncLocalStorage`; its `signal` is `undefined` outside a lock scope (`context/locks.context.js`).

## Runs

On 2026-11-19, bun 1.4.4, local Postgres, this branch.

- `server/test/cron-lease-pool.e2e-spec.ts`, every registered cron fired at once on a pool of 3: on the advisory-lock code (commit `2c5eb2ec07`) it stalled past 20 s; after the cutover it completed with no job error.
- `server/test/cron-lease-lost.e2e-spec.ts`, two due contract reminders, the lease taken over after the first send: one reminder sent and the run rejected with `LockLostError`. With `assertLeaseHeld()` removed from the reminder loop, the test failed.

## Shutdown under Bun

On 2026-11-19, local, this branch.

- A Nest 11.1.17 Express app under Bun 1.4.4 held a request across `app.close()` and released it 100 ms later: the response arrived at 104 ms and `close()` resolved at 6105 ms, while the keep-alive connection timed out. With `configureApp`'s middleware closing idle connections after each response once the server stopped listening, `close()` resolved at about 106 ms over three runs.

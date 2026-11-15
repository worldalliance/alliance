# Decisions

This task is step 1 of the plan in `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks` (its decisions 4, 5 and 7) and follows those decisions except where noted. The user deferred how the work is split, so the choices below are the agent's.

## One PR for the whole issue

The user left the split open. Metrics, readiness endpoint, #992's leftovers and the monitoring config go in one PR, as the plan's "Order of work" proposes: the alert rules query the metrics and probe the endpoint, so neither half can be checked end to end without the other.

## Pool metrics come from a `pg.Pool` subclass passed as TypeORM's `driver`

TypeORM builds its pool with `new this.postgres.Pool(...)`, where `postgres` is the `driver` option or `require("pg")`. `instrumentedPg` is `pg` with `Pool` replaced by `InstrumentedPool`, so the metrics read the very pool the app's `DataSource` uses (a requirement in the plan's decision 4), through TypeORM's own extension point instead of patching an instance. `InstrumentedPool` counts acquire timeouts in `connect()`, the one place a checkout that times out is visible. TypeORM's query logger never sees one. Both of pg-pool's timeout errors count: waiting in the queue, and opening a connection that outlasts `connectTimeoutMS` (EVIDENCE.md, "pg-pool"). The gauges sum over live pools, and a pool leaves that set when it ends, so a process with one pool reports that pool's counts.

## `GET /health/db`, bounded at 2 seconds

The probe is a `SELECT 1` through `DataSource.query`, so it needs a connection from the app's pool and fails while that pool is starved. It is bounded with the shared `withTimeout` (`common/src/timeout.ts`) at 2 seconds. That bound is agent judgement, not a researched value: it is well under the 10-second `connectTimeoutMS`, so the endpoint answers 503 before pg-pool gives up. A query that fails is logged at warn and answers 503 too.

`@nestjs/terminus` was not used. It would add a dependency and its own response shape for one check, and its ping check's timeout doesn't cancel the query either. The endpoint lives in its own `HealthModule` so `AppController` keeps no database dependency, and the existing `app.e2e-spec.ts` builds it alone. It is `@Public()` alone, like `GET /`: it reads no session, and `AuthOptionalGuard` returns early on public routes anyway. nginx answers 404 for everything under `/api/health/`, in any case (EVIDENCE.md, "nginx"), since each call takes a connection from the pool real requests use and its only caller, the monitoring host, reaches the API directly over the VPC.

## #992's leftovers

`connectionOptions()` moves to `server/src/datasources/connection-options.ts`. `dataSource.ts` builds the CLI `DataSource` and loads `dotenv` as soon as it is imported, which is what kept a unit test from importing it. The test now builds a `DataSource` from `connectionOptions()` and checks that its driver carries the pool size, timeout and `InstrumentedPool`. The app no longer imports `dotenv/config` through `dataSource.ts`. Bun loads `.env` itself before any code runs, and the CLI still loads it through `dataSource.ts`.

The `poolSize` comment now states the plan's threshold: the 11 locked crons hold at least 25 connections while each waits for another, so a pool under 26 can deadlock. The comment names the spec that sums those connections rather than the number, so a recount can't leave it stale. The old test's `LOCK_KEYS × 2` bound understated that. Its replacement lists that audit's per-job connection counts in the spec as a `Record` over `LOCK_KEYS`, so a new lock-taking cron doesn't compile until someone counts its connections, and checks the pool is larger than their sum less one per job.

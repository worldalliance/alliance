# Evidence

## pg-pool

Read from `node_modules/pg-pool/index.js` 3.13.0 (pg 8.20.0, typeorm 0.3.28), 2026-11-14.

- `connectionTimeoutMillis` (TypeORM's `connectTimeoutMS`) bounds both the wait in `_pendingQueue`, which fails with `timeout exceeded when trying to connect`, and opening a new client, which fails with `Connection terminated due to connection timeout`.
- The pool exposes `totalCount`, `idleCount` and `waitingCount`, and emits no event on a timeout.
- TypeORM's `PostgresDriver.loadDependencies` uses `options.driver` in place of `require("pg")`, and `createPool` calls `new this.postgres.Pool(...)` and later `pool.connect(callback)`.

## nginx

2026-11-14, Homebrew nginx 1.31.4 with only `location /api/` and the `/api/health/` block from `deploy/nginx/alliance.conf`, in front of a stub that answers 200 to everything. `/api/health/db`, `/api/health/db/`, `/api/Health/DB`, `/api//health/db`, `/api/%68ealth/db` and `/api/health/db?x=1` answered 404, and `/api/metrics` and `/api/healthz` 200. An exact `location = /api/health/db` had let `/api/health/db/` through.

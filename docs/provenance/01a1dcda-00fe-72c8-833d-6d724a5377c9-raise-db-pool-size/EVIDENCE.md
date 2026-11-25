# Evidence

Measurements and incidents only; this task researched no outside sources. Checked 2026-11-15 UTC.

## Incident

Production, server at the deploy of 2026-11-14 01:23 UTC, which included #969 and its `mmsMediaCopy` cron, the eleventh entry in `LOCK_KEYS`.

- nginx's error log counted "upstream timed out" lines per day: 0 on each of 2026-11-10 to 2026-11-13, 3052 on 2026-11-14, 43 in the first hour after the restart of 2026-11-15 00:42 UTC. The requests were ordinary API routes such as `/auth/refresh` and `/user/slug/<id>`.
- While requests were timing out, the host's load average was 0.00, `GET /` on the API (no database) answered in 1 ms, and the server process held exactly 10 connections to Postgres, node-postgres's default pool size.
- `pg_stat_activity` showed those 10 connections idle or idle in transaction for 33 minutes, their last statements `START TRANSACTION` or `SELECT pg_try_advisory_lock($1, $2)`. `pg_locks` showed each holding one advisory lock, the keys of 10 of the 11 `LOCK_KEYS` entries, `mmsMediaCopy` among them.
- `withPgSessionLock` in `server/src/notifs/lock-utils.ts` holds a pooled connection for the lock while the job's callback runs; callbacks that query through repositories take a second from the same pool. Ten jobs each holding one and waiting for a second fill a pool of 10.
- The server's `db_slow_query_duration_seconds` metric had no entries from requests, so the queries that ran were fast.

## Production database

`SHOW max_connections` returned 80. With the server's pool at 10, 7 other connections were open across all databases.

## Timeout experiment

TypeORM 0.3.28 on this worktree's database. With `poolSize: 2`, `connectTimeoutMS: 1000` and two query runners holding both connections, a third query rejected with "timeout exceeded when trying to connect" after 1001 ms. A `DataSource` built from `connectionOptions()` had `max=30` and `connectionTimeoutMillis=10000` on its node-postgres pool.

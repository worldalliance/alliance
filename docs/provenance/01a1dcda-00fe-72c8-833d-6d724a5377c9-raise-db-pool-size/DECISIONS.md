# Decisions

1. **Pool size 30.** Agent judgement, approved as REQUIREMENTS.md 2. The 11 lock-taking crons in `server/src/notifs/lock-keys.ts` can each hold two connections at once (EVIDENCE.md, "Incident"), which is 22; 30 leaves 8 for requests in that worst case and fits the database's `max_connections` of 80 (EVIDENCE.md, "Production database").
2. **Timeout through `connectTimeoutMS`.** TypeORM passes it to node-postgres as `connectionTimeoutMillis`, which also bounds the wait for a pooled connection (EVIDENCE.md, "Timeout experiment"). A starved pool then rejects queries, which the crons and request handlers surface as errors, instead of hanging them.
3. **Options in `pool-options.ts`.** `dataSource.ts` builds a `DataSource` and checks the worktree's database name when imported, so a unit test can't import it. The options sit in their own file so the test can.
4. **The test ties the pool size to `LOCK_KEYS`.** It fails when a new lock-taking cron brings twice their number up to the pool size, which is the condition that caused the incident. It assumes two connections per cron, the most the lock helpers and repositories take today.
5. **Not changed here.** The crons still take their second connection from the request pool, and the test database's `dataSourceTest.ts` keeps its defaults. The first is the longer-term fix REQUIREMENTS.md 1 leaves for later.

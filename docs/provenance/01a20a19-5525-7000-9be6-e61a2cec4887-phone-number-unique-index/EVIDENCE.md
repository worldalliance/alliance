# Evidence

## Measurements

2026-11-23, the `member-texting` worktree's local database (copied from the main checkout), PostgreSQL via `psql`, branch at `6cbd7ffd2`:

- `SELECT count(*) FROM (SELECT "phoneNumber" FROM "user" WHERE "deletedAt" IS NULL AND "phoneNumber" IS NOT NULL GROUP BY "phoneNumber" HAVING count(*) > 1) shared;` returned 0.
- `"user"` held 766 rows. Creating the same partial unique index under a throwaway name took 5.3 ms; it was dropped right after.

2026-11-23, production database, from the production host through `scripts/with_db_env.sh production psql`, with `PGOPTIONS="-c default_transaction_read_only=on"` (`SHOW default_transaction_read_only` returned `on`):

- The same duplicate query returned 0.
- `"user"` held 773 rows.

# Evidence

## What db-sync.env held, against Parameter Store (2026-11-14)

Method: SSM Run Command on the staging host sourced the file in a subshell and printed, for each key, its length and the first 12 hex digits of SHA-256 over a per-run random salt and the value; commented-out lines were evaluated one at a time. The same salted hashes were computed locally over every parameter under `/alliance/`, read with an admin login. No value was printed.

| Key in `db-sync.env` | Matches |
| --- | --- |
| `PROD_DB_HOST` | `/alliance/prod/server/DB_HOST` |
| `PROD_DB_USER`, `PROD_DB_PASSWORD` (active) | nothing; a separate user |
| `PROD_DB_USER`, `PROD_DB_PASSWORD` (commented out) | `/alliance/prod/server/DB_USERNAME`, `DB_PASSWORD` |
| `PROD_ASSETS_BUCKET` | `/alliance/prod/server/ASSETS_BUCKET` |
| `STAGING_DB_HOST`, `_USER`, `_PASSWORD` | `/alliance/staging/server/DB_HOST`, `DB_USERNAME`, `DB_PASSWORD` |
| `STAGING_ASSETS_BUCKET` | `/alliance/staging/server/ASSETS_BUCKET` |
| `PROD_DB_NAME`, `STAGING_DB_NAME` | the committed `DB_NAME`, `alliance` |
| `STAGING_PASSWORD_HASH`, `SLACK_WEBHOOK_URL`, `HEALTHCHECK_URL` | nothing; this `SLACK_WEBHOOK_URL` differs from the staging server's |

The file was mode 600, owned by `ec2-user`, last modified 2026-10-27.

## The sync's production user (2026-11-14)

Method: from the staging host, connected as the file's active production user and queried `pg_roles`, `pg_auth_members`, `has_table_privilege` and `has_schema_privilege`, read-only.

Not superuser; no `CREATEROLE`, `CREATEDB` or `BYPASSRLS`; member of `pg_read_all_data` only; `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` on 0 of 126 `public` tables, `SELECT` on all 126; owns no relations; no `CREATE` on `public`; `default_transaction_read_only = on`.

## Host tools (2026-11-14)

Both app hosts have `psql`, `pg_dump` and `pg_restore` (PostgreSQL 17.4), `python3`, the AWS CLI and `~/.bun/bin/bun`, checked through SSM Run Command.

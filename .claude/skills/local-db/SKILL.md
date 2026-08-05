---
name: local-db
description: Query the local Postgres database — credentials via server/.env, psql one-liners, TypeORM table/column naming, dev vs test DB.
---

# Local Database Access

Local Postgres credentials in `server/.env`. **Do not read the entire file.**

You _can_ grep for the lines containing the specific variables: `grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_NAME)' server/.env` (these variables are not sensitive).

## Ad-hoc queries

```bash
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -c "SELECT ..."
```

## Notes

- Table names: snake_case from TypeORM entity classes (`ReminderGroup` → `reminder_group`).
- Column names: keep entity camelCase, must be double-quoted in SQL (`"newStatus"`).
- Test DB (`server/.env.test`): password `postgres`, database `postgres` — don't mix up with dev DB.

# Prod data

Running `misc/load_staging_data.sh` sets the local DB data to the staging data, which is a pii-pruned version of prod.

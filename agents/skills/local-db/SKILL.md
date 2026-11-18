---
name: local-db
description: Read before querying the local Postgres database.
---

# Local database

Credentials in `server/.env`. Grep out the five vars below (not sensitive) rather than reading the file, which also holds live secrets:

```bash
export $(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_NAME)' server/.env | xargs)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -c "SELECT ..."
```

- Tables are snake_case from the TypeORM entity class (`ReminderGroup` → `reminder_group`); columns keep entity camelCase and must be double-quoted (`"newStatus"`).
- E2E tests drop and rebuild their database: `TEST_DB_NAME` in a worktree's `server/.env`, and in the main checkout `server/.env.test`'s database `postgres` (user and password `postgres`), which is easy to hit by mistake instead of dev.
- `scripts/load_staging_data.sh` overwrites the local db with staging data (pii-pruned prod).

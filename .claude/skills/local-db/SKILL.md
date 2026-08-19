---
name: local-db
description: Read before querying the local Postgres database.
---

# Local database

Credentials in `server/.env` — **don't read the whole file**, grep the five vars (not sensitive):

```bash
export $(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_NAME)' server/.env | xargs)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -c "SELECT ..."
```

- Tables are snake_case from the TypeORM entity class (`ReminderGroup` → `reminder_group`); columns keep entity camelCase and must be double-quoted (`"newStatus"`).
- Test db (`server/.env.test`) is user/database `postgres`, password `postgres` — easy to hit by mistake instead of dev.
- `misc/load_staging_data.sh` overwrites the local db with staging data (pii-pruned prod).

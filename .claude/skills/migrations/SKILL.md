---
name: migrations
description: Generate and review TypeORM database migrations in server/ — migration:generate vs migration:create, and the column-rename DROP+ADD pitfall. Read before generating or writing any db migration.
---

# Migrations

## Scope

A migration must never carry load-bearing logic — anything the running app depends on at request time (SQL functions, triggers, stored procedures) is owned by the app and installed by it, not by a migration. Migrations are for auto-generated schema changes and one-time data changes only.

## Generate

```
cd server && bun migration:generate -- migrations/{name}
```

Never hand-write migrations from scratch — always start from a generated one.

## Review

The generator can get things wrong. Key pitfall:

- **Column renames generate `DROP` + `ADD`**, deleting data. Edit to `RENAME COLUMN` instead.

Always review the generated SQL and edit when needed before committing.

## Raw-SQL migrations

For migrations with only raw SQL (one-time data changes) and no entity changes, `migration:generate` fails with "no changes". Use `migration:create`:

```
cd server && bun migration:create -- migrations/{name}
```

Then write SQL in the empty file.

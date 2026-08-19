---
name: migrations
description: Read before generating or writing a TypeORM migration in server/.
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

## Hand edits

Hand edits should alter ordering and data handling, never the end state.

Whenever you edit a migration by hand, tell the user which statements you changed and why. Also, ensure the resulting db schema is unchanged. One way to do this is by checking `migration:generate` reports `No changes in database schema were found`

## Raw-SQL migrations

For migrations with only raw SQL (one-time data changes) and no entity changes, `migration:generate` fails with "no changes". Use `migration:create`:

```
cd server && bun migration:create -- migrations/{name}
```

Then write SQL in the empty file.

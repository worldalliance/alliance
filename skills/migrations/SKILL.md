---
name: migrations
description: Read before generating or writing a TypeORM migration in server/.
---

# Migrations

Migrations carry auto-generated schema changes and one-time data changes only. Anything the running app depends on at request time — SQL functions, triggers, stored procedures — is owned and installed by the app.

## Generate

```
cd server && bun migration:generate -- migrations/{name}
```

Never hand-write a schema migration from scratch; always start from a generated file. Raw-SQL-only migrations (one-time data changes, no entity change) make `migration:generate` fail with "no changes" — use `cd server && bun migration:create -- migrations/{name}` and write the SQL into the empty file.

## Review

Always read the generated SQL before committing. The generator gets renames wrong: **a column rename comes out as `DROP` + `ADD`**, which deletes the data. Edit it to `RENAME COLUMN`.

## Hand edits

Hand edits change ordering and data handling, never the end state — confirm by re-running `migration:generate` and seeing `No changes in database schema were found`. Tell the user which statements you changed and why.

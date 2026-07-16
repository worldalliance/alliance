---
name: migrations
description: Generate and review TypeORM database migrations in server/ — migration:generate vs migration:create, and the column-rename DROP+ADD pitfall. Read before generating or writing any db migration.
---

# Migrations

## Generate

```
cd server && bun migration:generate -- migrations/{name}
```

Never hand-write migrations from scratch — always start from a generated one.

## Review

The generator can get things wrong. Key pitfall:

- **Column renames generate `DROP` + `ADD`**, deleting data. Edit to `RENAME COLUMN` instead.

Always review the generated SQL and edit when needed before committing.

## Raw-SQL / trigger-only migrations

For migrations with only raw SQL (triggers, functions) and no entity changes, `migration:generate` fails with "no changes". Use `migration:create`:

```
cd server && bun migration:create -- migrations/{name}
```

Then write SQL in the empty file.

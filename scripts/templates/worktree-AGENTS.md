## This is a worktree

You are in the `{{NAME}}` worktree (branch `{{BRANCH}}`), one of several checkouts running side by side. It has its own ports and its own database, and everything you need is inside this directory. Work stays here.

Use these in every URL you curl, open, or point playwright at:

- Server (NestJS): http://localhost:{{SERVER_PORT}}
- Frontend: http://localhost:{{FRONTEND_PORT}}
- Admin: http://localhost:{{ADMIN_PORT}}

Any other port answers from a different checkout, against its database. That is how two agents overwrite each other's data with nothing in either transcript to show it happened.

Databases: `{{DB_NAME}}`, and `{{TEST_DB_NAME}}` for `bun run test:e2e`, which drops and rebuilds its schema. This worktree's `server/.env` names both, as `DB_NAME` and `TEST_DB_NAME`. Connect to those two names. They outrank any database the `local-db` skill names, which describes the main checkout.

```bash
./scripts/with-env.sh              # prints this worktree's ports and databases
./scripts/with-env.sh <command>    # runs <command> with them exported
```

---
name: playwright
description: Read before verifying a change against the locally running apps.
---

# Driving the local apps

## Already running — check, don't start

- API: `bun --watch src/main.ts` in `server/`, port **3005**, hot-reloads on edit, OpenAPI at `/openapi.yaml`
- Admin (vite): **http://localhost:5174**, routes in `apps/admin/src/routes.ts`
- Frontend (vite): **http://localhost:5173**

`lsof -iTCP -sTCP:LISTEN -P | grep -E "node|bun"` to confirm.

## Authenticating as admin

Auth is a JWT in the `access_token` cookie (or `Authorization: Bearer`), signed with `JWT_SECRET` from `server/.env`, payload `{ sub: <userId>, email, tokenType: "access" }` — see `server/src/auth/guards/jwtreq.ts`. Get an id from the local db (`.claude/skills/local-db/SKILL.md`): `SELECT id, email FROM "user" WHERE admin = true LIMIT 1;`

Mint the token in a bun script with `jsonwebtoken` from the root `node_modules`, reading `JWT_SECRET` from `server/.env` — never print it.

- API: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3005/...`
- Admin GUI: set cookie `{ name: "access_token", value: token, domain: "localhost", path: "/" }` on the browser context, then `goto http://localhost:5174/<route>`. Cookies cross ports on `localhost`, so the app's calls to :3005 authenticate.

## Gotcha

`bunx playwright` resolves the latest playwright, whose chromium isn't installed. Use the repo's copy — `/…/alliance/node_modules/playwright/index.mjs` by absolute path when the script lives outside the repo.

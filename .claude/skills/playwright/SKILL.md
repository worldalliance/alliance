---
name: playwright
description: Verify changes against the locally running apps — curl the API, drive the admin/frontend GUIs with Playwright
---

# Playwright: verify driving the running apps locally

## What's usually already running (check, don't start)

- API dev server: `bun --watch src/main.ts` in `server/`, on port **3005** (hot-reloads on edit, OpenAPI at `/openapi.yaml`).
- Admin panel (vite): **http://localhost:5174** (title "Alliance").
- Frontend (vite): **http://localhost:5173**.

`lsof -iTCP -sTCP:LISTEN -P | grep -E "node|bun"` to confirm.

## Authenticating as admin

Auth is a JWT in the `access_token` cookie (or `Authorization: Bearer`), signed with `JWT_SECRET` from `server/.env`. Payload: `{ sub: <userId>, email, tokenType: "access" }` (see `server/src/auth/guards/jwtreq.ts`). Find an admin user id via the local DB (`.claude/skills/local-db/SKILL.md`): `SELECT id, email FROM "user" WHERE admin = true LIMIT 1;`

Mint a token with a bun script using `jsonwebtoken` from the repo root `node_modules` — read `JWT_SECRET` from `server/.env` in the script; never print it.

- **API surface**: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3005/...`
- **Admin GUI**: Playwright (repo root has `playwright` in node_modules with its chromium already installed — import from the absolute path `/…/alliance/node_modules/playwright/index.mjs` when the script lives outside the repo). Set the cookie `{ name: "access_token", value: token, domain: "localhost", path: "/" }` on the browser context, then `goto http://localhost:5174/<route>`. Cookies on `localhost` cross ports, so the admin app's calls to :3005 authenticate.

## Gotchas

- `bunx playwright` outside the repo resolves the latest playwright whose browser build isn't installed — always use the repo's copy.
- Admin routes are in `apps/admin/src/routes.ts`.

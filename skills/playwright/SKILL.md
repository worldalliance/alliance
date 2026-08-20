---
name: playwright
description: Read before driving the locally running apps: verifying a change in the browser, calling the API, authenticating as an admin, or driving the mobile app.
---

# Driving the local apps

## Already running — check, don't start

- API: `bun --watch src/main.ts` in `server/`, port **3005**, hot-reloads on edit, OpenAPI at `/openapi.yaml`
- Admin (vite): **http://localhost:5174**, routes in `apps/admin/src/routes.ts`
- Frontend (vite): **http://localhost:5173**

`lsof -iTCP -sTCP:LISTEN -P | grep -E "node|bun"` to confirm.

Mobile is the exception. [`MOBILE.md`](MOBILE.md) has its start command, selectors, and auth.

## Authenticating as admin

Auth is a JWT in the `access_token` cookie (or `Authorization: Bearer`), signed with `JWT_SECRET` from `server/.env`, payload `{ sub: <userId>, email, tokenType: "access" }` — see `server/src/auth/guards/jwtreq.ts`. Get an id from the local db (`(root)/skills/local-db/SKILL.md`): `SELECT id, email FROM "user" WHERE admin = true LIMIT 1;`

Mint it in a bun script with `jsonwebtoken` from the root `node_modules`. Keep `JWT_SECRET` and the minted token out of anything you print.

- API: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3005/...`
- Admin GUI: set cookie `{ name: "access_token", value: token, domain: "localhost", path: "/" }` on the browser context, then `goto http://localhost:5174/<route>`. Cookies cross ports on `localhost`, so the app's calls to :3005 authenticate.

## Running playwright

`bunx playwright` resolves the latest playwright, whose chromium isn't installed. Scripts live in the repo, so a bare `import { chromium } from "playwright"` picks up the repo's copy.

`chromium.launch()` gets playwright's own browser. Attaching to the user's Chrome over CDP takes over their session.

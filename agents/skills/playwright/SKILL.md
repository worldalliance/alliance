---
name: playwright
description: "Read before driving the local apps: verifying a change in the browser, calling the API, authenticating as an admin or member, or driving the mobile app."
---

# Driving the local apps

## Starting the apps

- API: hot-reloads on edit, OpenAPI at `/openapi.yaml`
- Admin (vite): routes in `apps/admin/src/routes.ts`
- Frontend (vite)

`./scripts/with-env.sh` prints this checkout's ports. A worktree's apps are often not running, and that is no reason to skip a browser check. Check whether the port answers first, since a second copy dies on a taken port; if nothing does, start what you need from the repo root, in the background, with `bun run server:dev`, `admin:dev` or `frontend:dev`, which use this checkout's ports; `server:dev` also loads the server's secrets. Stop the PIDs you started when done.

Mobile is the exception. [`MOBILE.md`](MOBILE.md) has its start command, selectors, and auth.

## Authenticating

Auth is a JWT in the `access_token` cookie (or `Authorization: Bearer`), signed with the server's `JWT_SECRET`; the session guard also checks the user row's `sessionGeneration` (`server/src/auth/session.service.ts`). Get an id from the local db (`(root)/agents/skills/local-db/SKILL.md`), such as an admin's: `SELECT id, email FROM "user" WHERE admin = true LIMIT 1;`. A member's id gives the member view. From the repo root, `TOKEN=$(cd server && ../scripts/with-secrets.sh server bun ../agents/skills/playwright/mint-token.ts <userId>)` mints an hour's token, or one lasting its optional second argument in hours, such as `8`; it runs from `server/` so Bun loads the server's env files, as the server does. Keep `JWT_SECRET` and the token out of anything you print.

- API: `curl -H "Authorization: Bearer $TOKEN" http://localhost:<api port>/...`
- Browser: set cookie `{ name: "access_token", value: token, domain: "localhost", path: "/" }` on the browser context, then `goto http://localhost:<port>/<route>`, the admin port for an admin or the frontend port for a member. Cookies cross ports on `localhost`, so the app's calls to the API authenticate.

## Running playwright

Scripts live in the repo, so a bare `import { chromium } from "playwright"` picks up the repo's copy. When its browser build isn't in the cache, launch fails with `Executable doesn't exist at …`; `chromium.launch({ channel: "chrome" })` runs the installed Chrome instead, with a fresh profile, and `bunx playwright install chromium` fetches the matching build but takes minutes.

`chromium.launch()` gets playwright's own browser. Attaching to the user's Chrome over CDP takes over their session.

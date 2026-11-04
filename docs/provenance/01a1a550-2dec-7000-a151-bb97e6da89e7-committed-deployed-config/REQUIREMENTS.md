---
user: Charles Lien
task: Move non-secret per-environment settings into committed config (Linear ALL-1962, step 2 of the Env Var Overhaul project)
---

# Requirements

## Context: the env var overhaul

- Non-secret per-environment settings (domains, Apple/Google IDs, mail sender, caps) are committed to the repo as typed per-environment config; Infisical holds only secrets. The repo is public, so only values that are already public belong there. (agent-proposed, user-approved)
- Each step keeps the old path working until its replacement is proven (expand, migrate, contract). (agent-proposed, user-approved)

## This task

- Staging and production read these settings from committed config, typed: `DOMAIN_NAME`, `ALT_DOMAIN_NAME` and the app and admin URLs derived from them, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICES_ID`, `APPLE_BUNDLE_ID`, `GOOGLE_CLIENT_ID`, `MAIL_FROM`, `USE_CLOUDFRONT`, `WAITLIST_PUBLIC_MAIL_DAILY_CAP`, `SEND_DEV_NOTIFS`, `DB_NAME`, and the web builds' `VITE_*` values from the tracked `apps/{frontend,admin}/.env.{staging,production}` files, which fold into the same config. (user)
- Of the GitHub secrets that may not be secret, `CLOUDFRONT_DOMAIN`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID` and `RDS_PORT` (as `DB_PORT`) are committed; `RDS_HOSTNAME` and `ASSETS_BUCKET_NAME` stay secret. (agent-proposed, user-approved)
- The config is a TypeScript module in `common/`, keyed by deployed environment, so the compiler checks that each environment lists every setting with the right type. The server's and web apps' config modules from ALL-1961 read from it, and the deploy workflow reads the values it needs through a `bun` script. (agent-proposed, user-approved)
- Each key has one name everywhere, the server's: `DB_HOST` and `ASSETS_BUCKET`, not `RDS_HOSTNAME` and `ASSETS_BUCKET_NAME`. (one name per key: the Linear issue, origin unknown; the server's names: agent-proposed, user did not object)
- The deploy stops reading the GitHub variables the committed config replaces. The user deletes those variables, and their copies in Infisical `staging`/`prod`, after deploys from the committed config are proven. (user)

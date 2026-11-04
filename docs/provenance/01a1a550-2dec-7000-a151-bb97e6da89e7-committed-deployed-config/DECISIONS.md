# Decisions

## Shape of the committed config

- `common/src/deployed-config.ts` holds one `DeployedConfig` per deployed environment, in a record typed per `NodeEnv`: staging and production must each hold a full `DeployedConfig`, the others `undefined`, so a new `NodeEnv` variant fails the build until it states whether it has one, and `deployedConfigFor` returns a defined config for a deployed environment named literally. A test ties the record to `isDeployed`. Its keys are the server's env var names, plus `DOMAIN_NAME` and `ALT_DOMAIN_NAME`, from which each app derives its URLs (`APP_URL` is `https://<DOMAIN_NAME>`, `ADMIN_URL` `https://admin.<DOMAIN_NAME>`, the web's `VITE_PUBLIC_POSTHOG_HOST` `https://<DOMAIN_NAME>/events/`), as the deploy did. Values carry their real types (number, boolean, list); a key one environment leaves unset (`WAITLIST_PUBLIC_MAIL_DAILY_CAP` in staging) is typed `| undefined` but still listed, so each environment states every setting.
- `deployedConfigEnv` turns a config into the env strings the server parses, once for both readers of that form: the server's fallback and the script whose output the deploy exports. Each app maps the config onto its own keys as env strings (`committedEnv` in `server/src/config/env.ts`, `withCommittedWebEnv` in `common/src/web-env.ts`) and parses them through the schemas from ALL-1961, so committed and environment values share one validation path and the startup and build checks cover both. Tests parse each environment's committed values through the server and web schemas.
- Dev and test aren't in it: their URLs depend on each worktree's ports.

## An environment value overrides the committed one

`envWithFallback` in `common/src/env.ts` layers a set environment value over the committed one; a blank value falls through, matching how ALL-1961 reads blanks as unset. `scripts/sync_prod_to_staging.sh` runs migrations with `NODE_ENV=staging` and `DB_NAME` pointed at a scratch database; with committed values winning, it would migrate the live staging database instead. Environment over config file is also the common layering (12-factor config, Vite's own `.env` handling). The deploy stops exporting every committed key, so nothing overrides them in a deploy.

## What moved and what didn't

- Committed: the GitHub variables `DOMAIN_NAME`, `ALT_DOMAIN_NAME`, the four `APPLE_*` IDs, `GOOGLE_CLIENT_ID`, `MAIL_FROM`, `USE_CLOUDFRONT`, `WAITLIST_PUBLIC_MAIL_DAILY_CAP`, `SEND_DEV_NOTIFS`; the deploy's hardcoded `DB_NAME`; and the approved secrets `CLOUDFRONT_DOMAIN`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, `RDS_PORT` (as `DB_PORT`). Values were copied from the GitHub environments and Infisical on 2026-11-03. The server's `POSTHOG_KEY` matched the web `.env` files' `VITE_PUBLIC_POSTHOG_KEY` in both environments, so one setting feeds both.
- `PANGRAM_API_URL`: the deploy's export matched the schema's default, so it is dropped rather than committed.
- `NODE_ENV` stays exported by the deploy: it selects the committed config.
- `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_DEV_CLIENT_ID`, GitHub variables in `production`, are read by no workflow and are left alone.
- The deploy's shell checks for an unset `ALT_DOMAIN_NAME`, `DOMAIN_NAME` or `MAIL_FROM` are gone: the type requires each.

## How the workflow reads it

A `deployed-config` job runs `scripts/deployed-config.ts`, which prints `KEY=value` lines into `$GITHUB_OUTPUT`; jobs that need the domains or the PostHog project id list it in `needs`. One job rather than a step per job, since six jobs read it and only one needs `bun install`.

## The web reader bundles both deployed environments' values

`sharedweb/lib/env.ts` picks the committed values by `import.meta.env.MODE`, so a bundle carries both environments' entries. Every value is public; selecting at build time instead would mean injecting them through Vite's env loading or `define`, a second path beside the reader.

## Required-key lists

`server/src/config/env.ts` keeps its per-environment required lists, renamed from `inInfisical`/`deployedInInfisical` to `setFor`/`deployedSet`, since once the GitHub variables and Infisical copies go the committed config sets some of those keys.

# Decisions

## Shape of the committed config

- `common/src/deployed-config.ts` holds one `DeployedConfig` per deployed environment, in a record typed per `NodeEnv`: staging and production must each hold a full `DeployedConfig`, the others `undefined`, so a new `NodeEnv` variant fails the build until it states whether it has one, and `deployedConfigFor` returns a defined config for a deployed environment named literally. A test ties the record to `isDeployed`. Its keys are the server's env var names, plus `DOMAIN_NAME` and `ALT_DOMAIN_NAME`, from which each app derives its URLs (`APP_URL` is `https://<DOMAIN_NAME>`, `ADMIN_URL` `https://admin.<DOMAIN_NAME>`, the web's `VITE_PUBLIC_POSTHOG_HOST` `https://<DOMAIN_NAME>/events/`), as the deploy did. Values carry their real types (number, boolean, list); a key one environment leaves unset (`WAITLIST_PUBLIC_MAIL_DAILY_CAP` in staging) is typed `| undefined` but still listed, so each environment states every setting.
- `deployedConfigEnv` turns a config into the env strings the server parses, once for both readers of that form: the server's fallback and the script whose output the deploy exports. Each app maps the config onto its own keys as env strings (`committedEnv` in `server/src/config/env.ts`, `withCommittedWebEnv` in `common/src/web-env-build.ts`) and parses them through the schemas from ALL-1961, so committed and environment values share one validation path and the startup and build checks cover both. Tests parse each environment's committed values through the server and web schemas.
- Dev and test aren't in it: their URLs depend on each worktree's ports.

## An environment value overrides the committed one

`envWithFallback` in `common/src/env.ts` layers a set environment value over the committed one; a blank value falls through, matching how ALL-1961 reads blanks as unset. `scripts/sync_prod_to_staging.sh` runs migrations with `NODE_ENV=staging` and `DB_NAME` pointed at a scratch database; with committed values winning, it would migrate the live staging database instead. Environment over config file is also the common layering (12-factor config, Vite's own `.env` handling). The backend deploy exports none of the committed values, so a deploy overrides nothing.

## What moved and what didn't

- Committed: the GitHub variables `DOMAIN_NAME`, `ALT_DOMAIN_NAME`, the four `APPLE_*` IDs, `GOOGLE_CLIENT_ID`, `MAIL_FROM`, `USE_CLOUDFRONT`, `WAITLIST_PUBLIC_MAIL_DAILY_CAP`, `SEND_DEV_NOTIFS`; the deploy's hardcoded `DB_NAME`; and the approved secrets `CLOUDFRONT_DOMAIN`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, `RDS_PORT` (as `DB_PORT`). Values were copied from the GitHub environments and Infisical on 2026-11-03. The server's `POSTHOG_KEY` matched the web `.env` files' `VITE_PUBLIC_POSTHOG_KEY` in both environments, so one setting feeds both.
- `PANGRAM_API_URL`: the deploy's export matched the schema's default, so it is dropped rather than committed.
- `NODE_ENV` stays exported by the deploy: it selects the committed config.
- `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_DEV_CLIENT_ID`, GitHub variables in `production`, are read by no workflow and are left alone.
- The deploy's shell checks for an unset `ALT_DOMAIN_NAME`, `DOMAIN_NAME` or `MAIL_FROM` are gone: the type requires each.

## How the workflow reads it

A `deployed-config` job runs `scripts/deployed-config.ts` into a `deployed-config.env` artifact of `KEY=value` lines. Each job that needs it calls the `.github/actions/deployed-config` composite action, which downloads it and reads its lines into step outputs; the host doesn't need it, since the server reads the committed config itself. One job rather than a step per job, since seven jobs read it and only one needs `bun install`. An artifact rather than job outputs: Actions drops a job output that holds the value of any secret in scope, environment- or repo-level, and the repo-level `RDS_PORT` is `5432`, the committed `DB_PORT`; another repo-level secret, such as `RDS_USERNAME`, could match part of a domain. A step output is only masked in logs. Tests in `scripts/deployed-config.test.ts` fail on any reference under `.github` to the `vars` context, whole-object reads such as `toJSON(vars)` included, or any read of a secret the config replaced, in dot or index syntax, so the old path can't grow back, and on an action output naming a key the script doesn't print, which would otherwise read as empty.

## The backend deploy exports only NODE_ENV

`scripts/deploy_backend.sh` rolls a failed release back by restarting the previous one in the deploy's shell. Until each environment ran a release with the server's committed-config fallback, that previous release needed the committed keys exported, so `deploy-nest-backend` exported every line of `deployed-config.env` and the four URLs under `BACKCOMPAT(ALL-2011)`. ALL-2011 removed those exports once staging and production both ran such a release.

## The web build defines its values from the committed config

`webEnvPlugin`'s `config` hook, in `common/src/web-env-build.ts`, defines `import.meta.env.<key>` for each of the four web values in a staging or production build (REQUIREMENTS: each web bundle carries only its own environment's four web values). It reads the set values with Vite's `loadEnv`, from Vite's env dir, so a value from a `.env` file or the environment wins and a blank one falls through. `.gitignore` lists the apps' `.env.staging` and `.env.production`, the tracked files the committed values replaced, so a local override can't be committed back over them. `sharedweb/lib/env.ts` reads `import.meta.env` alone. The build check lives in `web-env-build.ts`, apart from `web-env.ts`, because it imports `vite` and the committed config, and browser code imports `web-env.ts`. In staging and production the build check requires the four values, from the same list the committed values are keyed by, so a blank committed value fails the build rather than shipping a bundle without it; the apps pass no deployed keys.

## Required-key lists

`server/src/config/env.ts` keeps its per-environment required lists, renamed from `inInfisical`/`deployedInInfisical` to `setFor`/`deployedSet`, since once the GitHub variables and Infisical copies go the committed config sets some of those keys.

## deploy.yaml stays past 500 lines in this change

This change grows `.github/workflows/deploy.yaml` past the root `AGENTS.md` 500-line limit (984 lines before, 1020 after) without splitting it first. The user chose to accept the growth here and split the workflow separately, in ALL-2012.

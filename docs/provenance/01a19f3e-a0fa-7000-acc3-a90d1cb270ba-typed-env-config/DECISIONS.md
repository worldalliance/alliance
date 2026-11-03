# Decisions

## Where each app's config module lives

- Server: `server/src/config/env.ts`. `env(key)` and `requireEnv(key)` read typed values; `validateServerEnv()` checks the whole schema. `server/src/config/validate-env.ts` runs that check when imported and exits listing every problem. It is the first import of `main.ts` and `repl.ts`, the entry points that boot `AppModule`, ahead of `app.module.ts`, which imports `dataSource.ts`, whose connection options are built at import time. `dataSource.ts` doesn't import it: the TypeORM CLI runs migrations in CI, the seed scripts and the staging data sync with only the `DB_*` keys and `NODE_ENV`, and the whole schema would refuse those. Its own reads fail naming a missing `DB_HOST`, `DB_USERNAME` or `DB_NAME`, and a deployed one requires `DB_CA_CERT`.
- Web: the schema is in `common/src/web-env.ts`, which touches no `import.meta`, so the vite configs can import it by relative path like `dev-ports.ts` (Node can't load the workspace package's raw `.ts` while vite bundles its config). `webEnv(key)`/`requireWebEnv(key)` in `sharedweb/lib/env.ts` read `import.meta.env`. `validateWebEnv` and `webEnvPlugin` sit beside the schema. The plugin validates the resolved config's `VITE_` values and throws, so a bad value fails the build: for a static bundle, the build is startup. The check runs in the plugin's `buildStart`, not in the config itself, because `react-router typegen` resolves the config as a production build without deploy values, and typecheck CI and the deploy run it. A mode that isn't a `NODE_ENV` fails the build rather than requiring nothing.
- Shared helpers (empty-as-unset, required/optional/flag fields, an http(s) URL field, per-key reads, whole-schema parsing, the problem listing) are in `common/src/env.ts`, used by all three, and land in their own commit ahead of the server's. `parseEnv` parses each field on its own and then asks which keys the parsed values make required, rather than using a zod refinement on the object: zod skips an object's refinements once any field fails, so one bad key would hide every conditionally required one.

## Hand-rolled helpers rather than `@t3-oss/env-core`

`@t3-oss/env-core` is the widely used zod env-schema library, and it covers empty-as-unset and listing every problem. It doesn't fit three choices here: `createEnv` parses the whole environment once, while values here are read when used (below); its `emptyStringAsUndefined` deletes empty keys from the env object it is given, where these helpers never write to `process.env`; and a cross-field rule goes in its `createFinalSchema`, a schema over the whole object, which loses conditionally required keys the way a zod refinement does. What would remain of it is the field map these helpers already take.

## Per-key reads throw rather than return a `Result`

`readEnvKey`, `requireEnvKey` and each app's accessor throw naming the key, an exception to the `Result` rule in `AGENTS.md`. A value that fails there is misconfiguration, which should fail loudly where it is read, and every caller would unwrap a `Result` into the same throw. `parseEnv`, whose problem list a startup or build check reports, returns a `Result`.

## Values are read when used, not parsed once at import

About 20 server spec files, and some web and mobile tests, set `process.env` mid-test and expect the code to see it. Each accessor parses its one key on every call; the whole schema is checked once at startup or build. Parsing one small zod schema per read is cheap next to anything that reads config.

## Key names stay strings derived from the schema, not an enum

The user left this to the agent. `AGENTS.md` prefers enums for closed sets, but here the type is `keyof` the schema object: a typo fails the build, the type can't drift from the schema, and nothing branches on key names. An enum would write every name twice, add a second list to keep in step, and its member names aren't the contract; the env var names are, and those are what Infisical and the deploy use.

## An empty value is unset

The deploy writes `export KEY=${{ secrets.X }}`, which expands a secret that was never set to `KEY=`. A whitespace-only value, which no key can use, reads as unset too, and so does a required value its transform leaves empty, such as a list set to `,`: one rule for missing, whichever helper reads the key.

## Unknown or missing `NODE_ENV` refuses to boot

The user left this to the agent. `env("NODE_ENV")` throws on an unset or unknown value, and the server reads it while it boots. Behavior and the keys the server needs depend on `NODE_ENV`, so an unknown value leaves both undecidable; the deploy always sets it. The old warning and Slack post in `main.ts` are gone. The startup check reports it beside every other problem, and `env.spec.ts` covers the rejection. Tests that exercised behavior under an unset or bogus `NODE_ENV` (Twilio guard, PostHog client) now cover only valid values. The `currentNodeEnv()` callers (`review-account.ts`, `kora-cookies.ts`, `oauth-urls.ts`) read `env("NODE_ENV")` instead: their fallbacks for an unknown value could no longer fire, and keeping them left two policies for one value. `currentNodeEnv()` is gone.

## What each environment requires

- Always, `test` included: `NODE_ENV`, `DB_HOST`, `DB_USERNAME`, `DB_NAME`, `JWT_SECRET`, `JWT_REFRESH_SECRET`: the set `main.ts` already required, less `DB_PASSWORD`. Infisical has no test environment and CI gets no Infisical secrets yet, and a test cluster may use trust or peer auth. `DB_PASSWORD` stays optional in the schema because `dataSource.ts` reads it at import for migrations and e2e, which startup validation doesn't cover.
- Each other `NODE_ENV` adds the keys Infisical sets in its environment (the requirement), listed by name in `env.ts` from `infisical export` on 2026-11-03, intersected with the schema, flags (`SEND_DEV_NOTIFS`, `USE_CLOUDFRONT`) left out:
  - `development` (Infisical `dev`): `ADMIN_PASSWORD`, `ADMIN_URL`, `ADMIN_USER`, `APP_URL`, the five `APPLE_*` keys, `ASSETS_BUCKET`, `AWS_REGION`, `DB_PASSWORD`, `DB_PORT`, `EXPO_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_FROM`, `MAILGUN_SIGNING_KEY`, `PANGRAM_API_KEY`, `PANGRAM_API_URL`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_QUERY_KEY`, `SLACK_WEBHOOK_URL`, `SMTP_HOST`, `SMTP_PASSWORD`, `SMTP_USER`, and the three `TWILIO_*` keys.
  - `staging`: the five `APPLE_*` keys, `CLOUDFRONT_DOMAIN`, `DB_CA_CERT`, `DB_PASSWORD`, `EXPO_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_FROM`, `MAILGUN_SIGNING_KEY`, `NOTIF_TEST_PHONE_NUMBER`, `PANGRAM_API_KEY`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_QUERY_KEY`, `SLACK_WEBHOOK_URL`, `SMTP_HOST`, `SMTP_PASSWORD`, `SMTP_USER`, and the three `TWILIO_*` keys.
  - `production` (Infisical `prod`): staging's, plus `WAITLIST_PUBLIC_MAIL_DAILY_CAP`.
  - Left out of staging and production although Infisical sets them: `ADMIN_USER` and `ADMIN_PASSWORD`. Those are GitHub secrets no workflow writes to the server, and the server reads them only to seed an admin outside production, so requiring them would stop the next deploy from booting.
- `DB_PORT`, `AWS_REGION` and `PANGRAM_API_URL` have defaults, so `parseEnv` treats a required key as missing when its raw value is unset, not only when the parsed value is empty; otherwise the default would satisfy the requirement.
- Staging and production also require what the deploy sets outside Infisical: the four app and admin URLs and `ASSETS_BUCKET`. `DB_HOST`, `DB_USERNAME` and `DB_NAME` are always required already.
- Before requiring the dev keys, every path that boots the server with `NODE_ENV=development` was checked: the dev `server/.env` sets each, `server/.env.example` gained placeholders for the ones it left empty, and no CI job boots the server in development (`citesting` defaults the backend to `test`, and the workflows that set it pick `test`).
- The rules tied to what the code needs stay beside the Infisical lists, though today the lists cover them: sending (outside tests, when delivery is on) needs `MAIL_FROM`, the SMTP keys and the three Twilio keys, which `MmsService` refused to start without; signature checks need `TWILIO_AUTH_TOKEN` and `APP_URL`; every `NODE_ENV` but `test` needs `POSTHOG_KEY`, because the Mailgun webhook controller builds a PostHog client everywhere outside tests, a mail's own `production` tag deciding whether its events are captured. They keep holding once later steps of the overhaul move non-secret values out of Infisical and the lists shrink.
- `USE_CLOUDFRONT` adds `CLOUDFRONT_DOMAIN` in every environment; before, a missing domain silently fell back to serving images through the API.
- The OAuth clients answer 503 without their keys, and the PostHog query keys, Slack webhook, Expo token and Pangram key warn and carry on without theirs. Each is required anyway wherever Infisical sets it; in `test` they stay optional.
- Keys set nowhere stay optional.
- Web: every build but a development one needs `VITE_API_URL`, which `getApiUrl()` uses in every other mode. Deployed builds (mode `staging` or `production`) add `VITE_ALT_APP_URL`, and the frontend's add the PostHog key and host.

The rules that decide delivery, sending and Twilio signature checks (`notifDeliveryEnabledFor`, `deliverySendsFor`, `twilioSignatureEnforcedFor`) live in `env.ts` and are what the app calls too (`MailService` and `MmsService` through `deliverySends()`, `TwilioSignatureGuard` through `twilioSignatureEnforced()`), so validation and behavior can't disagree.

## Flags

`1`/`true` are on and `0`/`false`/unset are off; anything else is an error. Deployed values are `SEND_DEV_NOTIFS=1`, `USE_CLOUDFRONT=true` and an empty `SEND_DEV_NOTIFS` in production; `.env.example` uses `0`.

## Smaller choices

- `ASSETS_BUCKET` fields became getters calling `requireEnv`, so constructing a service in a test without a bucket doesn't throw; using one does.
- The Twilio guard reads `TWILIO_AUTH_TOKEN` and `APP_URL` through `requireEnv`. Wherever it enforces signatures, boot already requires both, with `APP_URL` a URL, so it has no branch or alert for either being unusable. `MmsService` drops its own check for missing Twilio keys for the same reason: boot requires all three whenever it sends.
- `JwtModule` reads `env("JWT_SECRET")` instead of Nest's `ConfigService`, the only `ConfigService` user, so `AppModule` drops `ConfigModule.forRoot`. Bun loads `.env` at process start; `ConfigModule` loaded it again only once Nest started, after module-level code had already read the environment.
- `server/.env.example` gains the schema keys it lacked and drops `APNS_*`, which nothing reads; it validates against the schema.
- `oauth.controller.ts` was past the 500-line limit, so it was split first, in its own commit, along the lines a read-only codex subagent recommended: callback handling into `OAuthCallbackService`, shared session helpers into `OAuthSessionService`, the proof cookie into `oauth-browser-proof.ts`, with routes, decorators and class/method names unchanged.

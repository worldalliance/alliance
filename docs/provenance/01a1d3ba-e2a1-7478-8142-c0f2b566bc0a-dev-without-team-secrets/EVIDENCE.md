# Evidence

Research by four Claude subagents on 2026-11-12, one per open question, each given the options without the parent agent's recommendation. Their reports follow as written, headings demoted, except that a review on 2026-11-13 corrected the Rails signing-secret claim and the survey counts to match the sources and the projects each report names, and the OAuth start route to match the controller. Source status labels are the subagents'. The project surveys name the projects but don't link the page checked for each, so their project-level claims are the subagents' account, unverified here.

## How a contributor opts in

**The question.** A contributor without team credentials needs a way to boot the server in development, but a team member who is missing a key must still get a loud error. Should that be (a) one opt-in flag, (b) one flag per integration, or (c) something else? Sources checked 2026-11-12.

### Findings

**Standards and vendor guidance**
- **NestJS docs** (vendor recommendation): "It's standard practice to throw an exception during application startup if required environment variables haven't been provided." A key counts as required when it has no default. `ConditionalModule.registerWhen` turns a module on or off with an env var. https://docs.nestjs.com/techniques/configuration
- **Twelve-Factor** (widely cited methodology, not a formal standard): env vars are "granular controls, each fully orthogonal to other env vars." It says grouping config into named environments "does not scale cleanly." Its dev/prod parity factor resists using different backing services in development. Nothing on optional keys or failing at startup. https://12factor.net/config, https://12factor.net/dev-prod-parity
- **OWASP Secrets Management Cheat Sheet** (de facto industry guidance): keep production and development secrets separate, and apply least privilege. Nothing on what an app should do when a secret is missing. Partly verified: the fetch read the page only partway. https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **Rails** (vendor): development and test get a `secret_key_base` that Rails generates randomly into `tmp/local_secret.txt` (`generate_local_secret`), while other environments need a key from their own credentials. The security guide still says the local key is derived from the app name, which the current source contradicts. This is a precedent for local-only signing secrets that need no credentials. https://github.com/rails/rails/blob/3f290b759c8e2ffe7c257951b1255740751355e4/railties/lib/rails/application/configuration.rb, https://guides.rubyonrails.org/security.html#session-storage
- **Twilio** (vendor): it offers test credentials and magic numbers. They can't reach a live account and make no real calls. https://www.twilio.com/docs/iam/test-credentials
- **Fowler, Feature Toggles** (well-known practitioner writing): toggles carry debt, and managing every kind of toggle the same way "can lead to pain." https://martinfowler.com/articles/feature-toggles.html

**What open-source projects do** (common practice; 9 projects checked)
- **Optional when blank, no flag:** Forem ("Optional 3rd Party Services"; "When blank don't render Google Analytics"; "Without keys, AI features are skipped"), Outline (integrations blank, but at least one sign-in provider is required), and Plausible (Google and Postmark are `nil` when unset, with no raise). That is 3 projects.
- **A flag for each integration:** Cal.com (`GOOGLE_LOGIN_ENABLED=false`), Supabase (`auth.external.<provider>.enabled = false`), PostHog (`EMAIL_ENABLED`, plus a `--tracing` switch) and Sentry (`SENTRY_USE_RELAY`). That is 4 projects.
- **Local mail catcher in place of real SMTP:** Mastodon (letter_opener, from older docs I didn't re-verify), Discourse (MailHog), Cal.com (port 1025), Supabase (local SMTP) and PostHog (Maildev). That is 5 projects.
- **Committed dev-only values:** Plausible (`"dummy_token"`, a fake SAML adapter, a default database URL), and the dev admin logins in Mastodon and Sentry.
- **Plausible's hard limits:** it still raises in every environment for its core keys (`SECRET_KEY_BASE`, `BASE_URL`).
- **Not seen:** none of the 9 uses a single "contributor mode" switch.
- **Not verified:** the GitLab GDK page came back empty, so its per-service `enabled` setting is unchecked.

### Which option the evidence favours (my judgement, built on the evidence above)

The evidence moderately favours a hybrid: one explicit opt-in for the contributor, with each integration then reporting "not configured" its own way. That is your (a), plus two pieces the question missed.

1. **(a) is the right outer switch.** No project uses it, but no project faces your constraint either: they make integrations optional and give up the loud failure for a team member. One explicit flag keeps NestJS's fail-at-startup rule as the default and lets the contributor opt out knowingly. Per-integration flags (b) are the most common pattern, but there those flags turn features *on* for people who have keys. Asking a contributor to set about 8 flags to turn things off gains nothing and adds toggle debt.
2. **Missed: some keys aren't integrations.** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_USER` and `ADMIN_PASSWORD` can't sensibly report "not configured", because without them there's no sign-in at all. Outline's "no sign-in options" failure shows the cost. The evidence favours a committed or derived development value for these, following Rails' generated local key and the default admins in Mastodon, Sentry and Plausible. They could even come out of the secret store for everyone, since nothing external depends on them.
3. **Missed: replacing an integration with a local fake.** A mail catcher (5 of 9 projects) or Twilio test credentials would let contributors exercise flows, not just skip them. Worth doing later; not needed for ALL-2086.
4. **Reject:** making integrations optional in development with no flag (it breaks the loud failure for team members), and a separate NODE_ENV (Twelve-Factor advises against environment buckets, and it multiplies config branches).

### Risks (my judgement)
- If a team member sets the flag, it hides a genuinely missing key. Mitigations: print a loud startup banner listing every integration that's off, and name the flag for what it does (e.g. `ALLIANCE_NO_TEAM_SECRETS`).
- Uploads still need AWS. The flag doesn't fix uploads unless storage gets a local-disk fallback, as Outline's `FILE_STORAGE=local` does. Worth scoping explicitly.
- Some integrations differ in how they fail without a key (Pangram throws on use, Slack and PostHog warn and skip). Those failures should stay as they are, not be silenced by the flag.
- Committed JWT values must be rejected outside development, and the existing `deployedSet` check should cover that.

## JWT secrets and the seeded admin



### Contributor dev mode: how to supply JWT secrets and the seeded admin (checked 2026-11-12)

**Recommendation:** have a setup step generate random values for all four keys into the gitignored `server/.env`, which is your option (c). The evidence supports this moderately for the JWT secrets and only weakly for the admin. If you would rather commit a fixed dev admin, projects do that often enough to defend it, but it goes against the security standards.

**The question:** when someone without team AWS access runs the server, how should `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_USER` and `ADMIN_PASSWORD` get their values? (a) The contributor sets them by hand, (b) the repo commits fixed dev values, or (c) something else.

### What the repo already does
- `ADMIN_USER` and `ADMIN_PASSWORD` are `optional(text)` in the schema. Only the development list (`setFor[Development]`) makes them required. `onModuleInit` never runs the seed in production.

### Evidence

**Standards.** None of them makes an exception for development, and none endorses committing fixed values.
- CWE-798, CWE-1392 and CWE-1393 (MITRE's weakness catalogue, an industry taxonomy rather than a binding standard) say to prohibit values "that do not vary for each installation" and have no dev scoping. CWE-798's own examples are debug backdoors. https://cwe.mitre.org/data/definitions/1392.html
- OWASP ASVS 5.0 (formal standard): 6.3.2 says default accounts such as "admin" must not be present, and 13.3.1 says "Secrets must not be included in application source code". That chapter explicitly covers development. https://github.com/OWASP/ASVS/tree/master/5.0/en
- OWASP JWT cheat sheet (OWASP guidance): an HMAC signing secret needs at least 160 bits of entropy from a secure random generator.
- OWASP Secrets Management cheat sheet §8.1 (OWASP guidance) says "Create standard test secrets and use them universally". This is the only source I found that leans towards fixed values.
- NIST SP 800-63B-4 (formal standard): passwords must be chosen by the user or assigned randomly. I couldn't confirm the final publication date.
- Twelve-Factor "Config" (common practice): the codebase should be publishable as open source "without compromising any credentials".

**Frameworks (vendor practice).** All four generate dev secrets randomly: Rails writes `tmp/local_secret.txt` on first boot in local environments, Django's `startproject` writes a random `SECRET_KEY`, Laravel's `key:generate` creates one, and Phoenix writes a random dev secret per project.

**Open-source projects (common practice).** Each count is out of the projects where I could verify the answer: 12 for secrets, 10 for admins.
- **Signing secret:**
  - 6 generate it locally: Rails, Mastodon, Forem, Discourse, Sentry, Lemmy.
  - 2 make the contributor set it, with an `openssl rand` hint in the example file: Outline, Cal.com.
  - 3 commit a fixed value: Plausible, Supabase CLI, PostHog. Only PostHog refuses to boot in production with its default.
  - 1 commits a value that is probably never read: Chatwoot.
- **First admin:**
  - 6 commit seed credentials that apply automatically in dev only: Mastodon (`mastodonadmin`), Forem, Cal.com, Chatwoot, Lemmy, PostHog.
  - 2 document fixed credentials: GitLab GDK, Sentry.
  - 1 creates the admin through an interactive CLI: Discourse.
  - 1 makes the first signup admin through config: Plausible.

### Which option the evidence favours

**JWT secrets.** The evidence moderately favours (c): a setup step writes random values into the gitignored `server/.env`. The standards and framework defaults line up behind it. (b) is defensible, and three projects plus the repo's own test file do it. A dev-signed token can't work on staging or prod, because those read their secrets from a separate store. (a) works but adds a manual step for every contributor, which only 2 of 12 projects ask for.

**Admin.** The evidence leans weakly towards (c) and is split.
- Projects mostly commit seed credentials (6 to 8 of 10).
- The standards (ASVS 6.3.2, CWE-1392) argue against it, and the `0.0.0.0` listen address makes it a little riskier here.
- My judgement: the same setup step generates `ADMIN_PASSWORD` and prints it once. The contributor gets an admin with no fixed password living in the repo.

### Options the question missed (my judgement)
1. **Leave `ADMIN_USER` optional in contributor mode.** The contributor signs up normally and promotes themselves with a small CLI or SQL step, like Discourse and Plausible. That's simpler than a seed.
2. **Generate the secret at boot into a gitignored file, Rails-style.** No setup step at all, but it hides config generation inside startup.
3. **Reuse the `.env.test` values for JWT.** No new committed secret, but it ties dev and test together.

### Risks
- **Hiding missing keys from team members.** Contributor mode must be switched on explicitly, for example by a flag the setup step writes, and never inferred from a missing AWS login. Otherwise a team member who just lacks a key gets a quietly degraded server instead of a validation error, which breaks "fail loudly".
- **Committed values reaching a deployed environment.** If you go with (b), add a guard like PostHog's: refuse to boot outside development when a secret equals the committed value. The current seed already skips production, but it does run on staging if `ADMIN_USER` is ever set there.
- **Re-running setup.** Regenerating the secrets logs out existing local sessions. That's harmless, but say so in the setup output.

I couldn't verify: the official California SB-327 text (I only had secondary sources), the 800-63B-4 final date, GDK's dev secret mechanism, Outline's first-admin flow, or Cal.com's production guard.

## Uploads without AWS credentials

### Uploads for contributors without AWS credentials (ALL-2086)

**Question:** how should image, video and hosted-doc uploads work for someone who has no AWS login? (a) Leave it out of this change, document it and file a follow-up, or (b) add a local alternative now.

### What the code does (checked in this worktree)
- The code makes only four kinds of S3 call: `PutObject`, `GetObject` (with `Range`), `ListObjectsV2` and `DeleteObject`. They live in the images, videos, hosted-docs and forum-export services, plus `pipeS3Object`.
- Nothing in `server/src` presigns URLs, although `@aws-sdk/s3-request-presigner` is still declared in `server/package.json`. In development, `getImageSource` returns `http://localhost:<port>/images/<key>`, so the server streams every read itself. CloudFront is only used in staging and production. Browsers never talk to S3, so a local store needs no CORS setup or presigned URLs.
- The e2e tests swap in a mock for `s3.send`, so tests already need no real S3.
- **Risk in today's code:** without credentials, the client still constructs. A failed upload throws a 500. A failed read is caught in `pipeS3Object` and returned as **404**, so a missing credential looks like a missing file. That goes against "fail loudly".

### Evidence (checked 2026-11-12)
- **Twelve-Factor** (formal-ish methodology, not a standards body): "The code for a twelve-factor app makes no distinction between local and third party services." Swapping one for another should only change config. [12factor.net/backing-services](https://12factor.net/backing-services)
- **Rails Active Storage** (vendor recommendation): it ships "a local disk-based service for development and testing" and recommends choosing the service per environment. [Rails guide](https://guides.rubyonrails.org/active_storage_overview.html)
- **What projects do** (common practice, 4 verified):
  - Mastodon uses the local filesystem by default; S3 is opt-in through `S3_ENABLED`. [docs](https://docs.joinmastodon.org/admin/optional/object-storage/)
  - Outline offers `FILE_STORAGE=local`. [docs](https://docs.getoutline.com/s/hosting/doc/file-storage-N4M0T6Ypu7)
  - PostHog's dev compose runs a SeaweedFS `objectstorage` service with fixed dummy credentials. [compose](https://raw.githubusercontent.com/PostHog/posthog/master/docker-compose.base.yml)
  - Supabase Storage supports `s3` or `file` backends; its sample points at a local endpoint on port 9000 with dummy keys and `FORCE_PATH_STYLE`. [sample](https://raw.githubusercontent.com/supabase/storage/master/.env.sample)
  - I could not verify Discourse, Forem, Sentry or the GitLab Development Kit.
- **Tool status** (mostly secondary sources, so verify before relying on them):
  - **MinIO:** the community repo went into maintenance in December 2025 and was archived in April 2026; official binaries and images stopped in October 2025. The code is still AGPLv3. Don't adopt it. [1](https://github.com/michelangelo-ai/michelangelo/issues/672), [2](https://pinggy.io/blog/minio_archived_self_hosted_s3_alternatives/)
  - **LocalStack:** since 23 March 2026 the image needs an account and auth token. That defeats the purpose for outside contributors. [testcontainers issue](https://github.com/testcontainers/testcontainers-java/issues/11568)
  - **s3rver:** archived 14 September 2025. [repo](https://github.com/jamhall/s3rver)
  - **Garage:** AGPL, v2.3.0 (April 2026) added `--single-node` and `--default-bucket`, and it has NLnet funding. [blog](https://garagehq.deuxfleurs.fr/blog/2026-04-performance-reliability/)
  - **SeaweedFS:** used in PostHog's dev setup, as above. I did not verify its release cadence beyond that.
  - **RustFS:** Apache-2.0, 1.0 GA reported for September 2026 by secondary sources only. [linuxiac](https://linuxiac.com/rustfs-1-0-s3-compatible-object-storage-reaches-ga/)

### Cost here (agent judgement)
- **S3-compatible container** (Garage or SeaweedFS): roughly a compose service, a bucket-creation step, and optional `S3_ENDPOINT` plus credential keys passed explicitly to `S3Client` with `forcePathStyle`.
  - The credential keys need their own names. `with-secrets.sh` refuses `AWS_ACCESS_KEY_ID` in `server/.env`.
  - No service code changes, and the code paths stay the same as production.
  - Cost: Docker becomes a dependency (the repo already uses compose for the test database).
- **Filesystem storage behind an interface:** rewrite five services and `pipeS3Object`, including Range/Content-Range handling and delete-by-prefix. That is more code, and dev behaviour drifts from production.
- **Fake/in-memory store:** files are lost on restart and it adds little over the existing test mocks.

### An option the question missed
(c) In the no-credentials mode, make `ASSETS_BUCKET` optional, and have upload and read endpoints return a clear 503 ("uploads are not configured"). That copies the pattern Google and Apple sign-in already use. It fixes the silent 404 and keeps a missing bucket a loud validation error for team members, which the brief requires.

### Recommendation (agent judgement)
**(a) plus (c) in this change**, with (b) as a container-based follow-up (SeaweedFS or Garage) through an optional `S3_ENDPOINT`. Confidence is moderate.
- The evidence supports offering *some* local backend, since all four verified projects do. It doesn't say it has to land in the same change.
- Of the local options, the evidence favours an S3-compatible container over filesystem storage for this codebase. The server only uses four S3 calls and serves every read itself, so swapping the endpoint costs little.
- Without (c), option (a) leaves misleading 404s, which breaks "fail loudly".

### Risks
- The tool landscape changed fast in 2025–26. Pin a version, and check the status again when the follow-up is done.
- If Garage or SeaweedFS handle `Range` or `ListObjectsV2` slightly differently from AWS, dev could pass and production fail. Run the existing e2e cases against the container once.
- AGPL (Garage, SeaweedFS is Apache) only matters for a dev-only container if it is redistributed. That is my judgement, not legal advice.

I edited no repository files and wrote nothing to `.scratch/`.

## Sign-in buttons when a provider isn't configured

I couldn't confirm a general rule for this dev-only case, so the recommendation below is my judgement: **(a) with a clear error message**. The code reading also turned up an option the question missed. Evidence and judgement are kept separate. Checked 2026-11-12. Nothing in the repo was edited. Downloaded project source is in `.scratch/oauth-ui-research/`.

### Question
When the dev server has no Google or Apple sign-in configured, what should the web and mobile login screens do: (a) keep the button and fail with the server's error, (b) hide it based on what the server reports, or (c) something else?

### What happens today (read in this repo's code)
- **Web:** `sharedweb/ui/OAuthButtons.tsx` always shows one link per provider. It is used in `AccountStep.tsx` and `KoraSignIn.tsx`. Clicking opens the server's `GET /auth/:provider/start` in the whole tab. `beginFlow` then throws a 503 "Google sign-in is not configured" (`server/src/auth/oauth/oauth.controller.ts:157`, `google-oauth.client.ts:23`). No exception filter turns that into a page, so the person sees **Nest's raw JSON 503 on the server's origin**, outside the app.
- **Mobile:** the native Google or Apple sheet runs first and works, because `apps/mobile/lib/oauth.ts` hardcodes the public Google client ID. The server's `/native` call then 503s. `requestFailure` maps that to `OAuthError.Failed`, which shows "Continuing with Google didn't work. Please try again." That text is misleading, because trying again can't succeed.
- **The missed option:** native sign-in only needs public values. `verifyIdentityToken` uses only `clientId` (Google) or `bundleIds` (Apple). It fails only because it calls `config()`, which also requires `GOOGLE_CLIENT_SECRET` or `APPLE_PRIVATE_KEY_BASE64`. Google's guidance says verifying a token means checking the signature, `aud`, `exp` and `iss` against your client ID, with no secret involved ([Google backend auth](https://developers.google.com/identity/sign-in/web/backend-auth), vendor recommendation). The public IDs are optional in the env schema. If they were set in committed dev config (not checked), native sign-in could work for contributors without any secret.

### Evidence on hide vs disable vs show-and-error
- **Usability guidance.** Jakob Nielsen names all three patterns and favours a muted, disabled control that says why it's unavailable, citing user testing ([UX Tigers](https://www.uxtigers.com/post/inactive-buttons); his personal site, not NN/g; "user testing" is his claim and I didn't see the study). Smashing Magazine says disable when people should know the feature exists and hide when it's irrelevant ([Smashing](https://smashingmagazine.com/2024/05/hidden-vs-disabled-ux/), common practice). I couldn't open the NN/g pages themselves, so treat this as unverified secondhand material. I didn't check Apple HIG, Material or GOV.UK.
- **What other projects do (common practice, all 4 I read the source of):** they hide providers that aren't configured, deciding on the server.
  - Outline registers its Google plugin only when both client ID and secret are set, and the client renders the providers list its auth API returns ([plugins/google/server/index.ts](https://github.com/outline/outline/blob/main/plugins/google/server/index.ts), [routes/api/auth/auth.ts](https://github.com/outline/outline/blob/main/server/routes/api/auth/auth.ts)).
  - Cal.com (found in its `cal.diy` repo) computes `IS_GOOGLE_LOGIN_ENABLED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_LOGIN_ENABLED)` on the server and passes it to the login page as a prop. Its e2e test is skipped when it's false.
  - Mastodon registers providers from env flags and its login view loops over the registered ones ([3_omniauth.rb](https://github.com/mastodon/mastodon/blob/main/config/initializers/3_omniauth.rb), [sessions/new.html.haml](https://github.com/mastodon/mastodon/blob/main/app/views/auth/sessions/new.html.haml)).
  - Forem renders `authentication_enabled_providers` ([authentication_helper.rb](https://github.com/forem/forem/blob/main/app/helpers/authentication_helper.rb)).
  - Supabase Auth's public `GET /settings` returns an `external` map of provider → enabled ([docs](https://supabase.com/docs/guides/self-hosting/self-hosted-oauth)), but I didn't verify how its UI uses it. GitHub's rate limit stopped me before I could check Discourse.
- **Caveat on that evidence:** those projects are self-hosted products, where the operator turns a provider off for good and real users see the result. Here the missing provider only ever happens on a contributor's dev server, because deployed environments require these keys (`deployedSet` in `server/src/config/env.ts`).

### Which option the evidence favours (agent judgement)
- **(b) hide** matches what other projects do, but it costs a new endpoint plus web and mobile changes for a state production can never reach. Hiding buttons also changes the screen contributors test against.
- **(a) as it stands** isn't acceptable. The raw JSON page and the "please try again" toast are both silent-ish failures, against the repo's fail-loudly rule.
- **My recommendation:** keep the buttons, but make the failure say what's wrong:
  - **Web:** have `/start` send the browser back to the app with an error code instead of the 503 JSON.
  - **Mobile:** map 503 to a new error, e.g. `OAuthError.NotConfigured`, worded like "Google sign-in isn't set up on this server."
- **Also consider (d):** split `config()` so native token verification needs only the public IDs. Mobile Google and Apple sign-in would then work for contributors outright. A dev-only banner listing missing integrations is cheap too, but it's extra UI to maintain.
- **How strong the evidence is:** moderate for "decide on the server, don't hardcode in the clients"; weak for hide vs show in a dev-only case.

### Risks
- **(b):** a team member whose secrets fail to load sees the buttons vanish instead of a loud error. Startup validation still catches that, unless contributor mode is somehow turned on by accident.
- **(d):** native verification would trust tokens from the team's real Google project on any contributor's server. That seems acceptable because accounts live in each contributor's local database, but it should be decided explicitly.
- **Wording:** a "not configured" message on web needs a new error variant shared across `common/src/oauth.ts`. Adding it to the enum makes the build flag every place that has to handle it.

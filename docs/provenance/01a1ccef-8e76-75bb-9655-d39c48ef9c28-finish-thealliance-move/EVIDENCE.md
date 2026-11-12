# Evidence

## Remaining worldalliance.org references in the repository

Method: a codex subagent (`codex exec -s read-only`) searched tracked files and ignored config at `25d3e96367` on 2026-11-11, case-insensitively, including escaped, percent-encoded and `org.worldalliance` forms, excluding dependencies, build output, lockfiles and `.git`. It counted the domain's forms (the domain, its subdomains and email addresses, `worldalliance\.org`, `worldalliance%2Eorg`, `org.worldalliance`), not bare `worldalliance`, which also names the GitHub org and Linear workspace. This command counts the tracked-file matches (`-c` gives lines, `-l` files), one match, line and file short of the totals below; the remaining one is in an ignored `server/.env`:

```bash
git grep -i -I -o -E 'worldalliance(\.|\\\.|%2e)org|org\.worldalliance' 25d3e96367 -- ':!*.lock'
```

- 404 matches on 295 lines in 85 files: 301 in tests and fixtures (170 in `citesting/fixtures/seed_dataonly.sql`), 40 in docs and provenance (32 in provenance), 33 in user-facing content, 23 in runtime config, 7 in code the transition needs.

## Code paths the move touches

Method: read by hand at `25d3e96367` on 2026-11-11, with `git grep -n -i switchedDomainAt` for its readers.

- Production and staging set `DOMAIN_NAME` to the legacy domain and `ALT_DOMAIN_NAME` to the new one (`common/src/deployed-config.ts:43`, `:58`). nginx maps `__DOMAIN__` to `__ALT_DOMAIN__` on the main vhost (`deploy/nginx/alliance.conf:21-27`) and redirects there (`:118`, `:130`), the admin vhost maps `admin.__DOMAIN__` to `admin.__ALT_DOMAIN__` (`deploy/nginx/alliance_admin.conf:16-20`), and server links prefer `ALT_APP_URL` (`server/src/search/approutes.ts:40`). Swapping the two values reverses all three.
- The same `__DOMAIN__` names each vhost's certificate lineage: `ssl_certificate` reads `/etc/letsencrypt/live/__DOMAIN__/` (`deploy/nginx/alliance.conf:230-231`) and `/etc/letsencrypt/live/admin.__DOMAIN__/` (`deploy/nginx/alliance_admin.conf:51-52`), matching the `--cert-name` in each file's certbot command (`deploy/nginx/alliance.conf:222`, `deploy/nginx/alliance_admin.conf:46`). Making thealliance.org `DOMAIN_NAME` therefore points both vhosts at lineages named for thealliance.org hosts. The frontend deploy writes the rendered `alliance.conf` into `/etc/nginx/conf.d` before `nginx -t` and leaves it there when the test fails (`.github/workflows/deploy.yaml:350-352`), so a missing lineage breaks every later reload, the admin deploy's included. The admin deploy checks its lineage covers both admin hosts before writing its vhost and prints the certbot command when it doesn't (`.github/workflows/deploy.yaml:421-428`); the frontend deploy has no such check.
- On the main vhost, only invite links and the public pages in `$static_page_redirect_host` redirect today (maps at `deploy/nginx/alliance.conf:33-47`, mirrored in `apps/frontend/src/lib/altDomainPages.ts`). Invite links get a `301` (`:118`), the public pages a `302` (`:130`). The admin vhost already sends every path on `admin.__DOMAIN__` to `admin.__ALT_DOMAIN__` with a `302` (`deploy/nginx/alliance_admin.conf:30-32`).
- Mobile production and staging call `worldalliance.org/api` and `/events` (`apps/mobile/lib/releaseTarget.ts:37-53`) and authenticate with bearer tokens (`apps/mobile/lib/session.ts:95`). Their messaging socket connects to the same host, `wss://worldalliance.org` plus the default `/socket.io/` path (`apps/mobile/lib/config.ts:65-68`, `:91-100`, `shared/lib/messagingSocket.ts:116-118`), with the websocket transport only (`:38`, `:41`); nginx proxies it in its own `location /socket.io/` (`deploy/nginx/alliance.conf:181`). No minimum app version is enforced anywhere in the repo.
- The Twilio signature guard derives the expected URL from `APP_URL` (`server/src/mms/twilio-signature.guard.ts:24`).
- Session cookies are host-only (`server/src/auth/auth.service.ts:96`).
- Outside DTOs and fixtures, the server writes `switchedDomainAt` when a member opts in (`server/src/user/user.service.ts:228-229`), passes it into the visibility context (`server/src/user/user-visibility-context.service.ts:86`), and reads it as logic only in the legacy-host sign-in block (`server/src/auth/auth.controller.ts:107-119`).
- Clients read `switchedDomainAt` in two places. The web app's `DomainMigrationModal` (`apps/frontend/src/components/DomainMigrationModal.tsx:48`, mounted on every signed-in page at `apps/frontend/src/applayout.tsx:91`) redirects opted-in members on the legacy hosts to thealliance.org and shows everyone else the opt-in prompt. For the `SwitchedDomainAt` form condition, the server computes presence with `isPresent` (`common/src/forms/user-properties.ts:66-69`, `:119`) and sends `userPropertyHasValue.switchedDomainAt` as a boolean (`server/src/user/dto/user-visibility-context.dto.ts:17`). Clients, mobile included through `useVisibilityContext`, evaluate the condition with `presence[cond.property] ?? false` (`common/src/forms/visibility.ts:248`), so a missing key reads as unset.
- Field elements carry their conditions (`visibleIfFormula`, `requiredIfFormula`, `common/src/forms/form-schema.ts:77-78`), and a `userPropertyHasValue` condition parses its property with `z.enum(UserValueProperty)` (`common/src/forms/visible-if-formula.ts:77`). A form's schema lives in `FormSnapshot` rows (`server/src/tasks/entities/formsnapshot.entity.ts:57`), deduplicated by a unique hash (`:44`): the form points at its current one and keeps its earlier ones (`server/src/tasks/entities/form.entity.ts:55-67`), and each response and draft points at the one it was filled against (`formresponse.entity.ts:122`, `formresponsedraft.entity.ts:70`). Readers of a stored snapshot skip an element that no longer parses, or read its answers by the question's current definition and fail if its kind has changed (`common/src/forms/stored-schema.ts:21-38`, `:47-70`).
- A signed-out visitor whose app page request is refused is sent to `/login`, with the page's path but not its query, unless the path contains `/actions/` and the `was-logged-in` flag, which the app sets in `localStorage` after a signed-in visit, is absent (`apps/frontend/src/applayout.tsx:28-33`, `:51-67`). `/` is the public landing page, outside the app layout (`apps/frontend/src/routes.ts:13`).
- No session or last-activity table exists, so recent activity can't be counted from the database.

## Opt-in counts on staging

Method: read-only `psql` over the SSH route `scripts/download_staging_data.sh` uses, 2026-11-11. Staging is production with personal data pruned, at least as recent as 2026-11-06.

- 753 user rows with `deletedAt IS NULL` (accounts that exist, not people who use the site; the user estimates about 200 actual users). 163 have `switchedDomainAt` set.
- Opt-ins per week starting: Aug 31 69, Sep 7 30, Sep 14 21, Sep 21 18, Sep 28 10, Oct 5 10, Oct 12 2, Oct 19 1, Oct 26 1, Nov 2 1.

## Outside sources

Question: what must each host serve or register for universal links, Google sign-in and Sign in with Apple to keep working across the move?

Vendor recommendations, each page opened and checked 2026-11-11.

- Apple requires an association file on each host and does not follow redirects to it: "host your AASA at each domain and subdomain", and a `301` or `302` "is not supported when hosting the AASA file as redirects are not supported" (https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links).
- Google OAuth redirect URIs must match a registered URI exactly: "The value must exactly match one of the authorized redirect URIs for the OAuth 2.0 client" (https://developers.google.com/identity/protocols/oauth2/web-server).
- Sign in with Apple web domains and return URLs are configured on the Services ID in the Apple developer account: "Under Website URLs, provide your domains, subdomains, or return URLs as a comma-delimited list." (https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)

Question: does a redirect change the referrer a browser sends, and may a browser cache a `301`?

Formal standards, each page opened and checked 2026-11-11.

- A redirect keeps the request's referrer. Fetch's HTTP-redirect fetch changes only the referrer policy: "Invoke set request’s referrer policy on redirect on request and internalResponse" (https://fetch.spec.whatwg.org/#http-redirect-fetch, step 19), which sets nothing but the policy (https://w3c.github.io/webappsec-referrer-policy/#set-requests-referrer-policy-on-redirect). The redirected request reruns main fetch, where determine request's referrer starts from the request's existing referrer: "Let referrerSource be request’s referrer" (https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer, step 3).
- "A 301 response is heuristically cacheable; i.e., unless otherwise indicated by the method definition or explicit cache controls" (https://www.rfc-editor.org/rfc/rfc9110#section-15.4.2).

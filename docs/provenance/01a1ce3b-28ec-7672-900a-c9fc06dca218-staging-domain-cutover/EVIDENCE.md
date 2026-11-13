# Evidence

## nginx behaviour of the rendered templates

Method: rendered `deploy/nginx/alliance.conf` and `alliance_admin.conf` with each environment's values, swapped TLS for plain listeners and the upstreams for stub servers that echo the request, and served them from a local nginx 1.31.4 (Homebrew), probing with `curl -H Host:`. The servers run the Amazon Linux nginx package (1.26 per the `/assets/` comment in `alliance.conf`); a `map` keyed on a string combining several variables, with regex keys and a variable as the value, is a long-standing nginx feature. 2026-11-12.

- Staging (`cut-over`), page loads: on `staging.worldalliance.org` and `www.`, `/`, `/tasks?a=1&b=2`, `/login`, `/signup?ref=abc`, `/docs/x`, `/a%20b?`, `/actions/1.data` and `/build-version` returned `302` to the same path and query on `staging.thealliance.org`, nothing appended (`/a%20b?` kept its bare `?` in `Location`), for `Sec-Fetch-Mode: navigate` and for no such header with Safari's navigation `Accept` (`text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`). `admin.staging.worldalliance.org/users?x=1` returned `302` to `admin.staging.thealliance.org/users?x=1`.
- Staging (`cut-over`), requests that stay: on `staging.worldalliance.org`, the same paths sent with `Sec-Fetch-Mode` `cors`, `no-cors` or `same-origin`, with `cors` plus `Accept: text/html`, or with no `Sec-Fetch-Mode` and `Accept: */*` or none, each answered `200`, except `/signup?ref=abc`, which took the invite redirect's `301`. `/api/x`, `/socket.io/x` and `/.well-known/apple-app-site-association` reached their upstreams on a navigation, and `/assets/a.js` was served from disk (`404`, no files locally), not redirected. On `staging.thealliance.org` `/tasks` answered `200` in every mode.
- Production (`opt-in`): `/`, `/tasks`, `/login` and plain `/signup` answered `200` on `worldalliance.org` for `navigate`, `cors`, `text/html` and `*/*`. `/signup?ref=abc` and `/?ref=abc` returned `301` to `thealliance.org`, and `/people` `302`, as before. A diff of the rendered config against the one rendered from `8196603b37`, with comments and blank lines dropped, shows only the inert `opt-in` map, the unreachable `if ($moved_host)` blocks, the `/.well-known/` location and `$alt_host` renamed to `$new_host`.

## Live hosts before the change

Method: `curl` and `openssl s_client` from a workstation, 2026-11-11.

- `https://worldalliance.org/api/`, `https://staging.worldalliance.org/api/`, `https://staging.thealliance.org/api/`, both association files and `/events/static/array.js` on `staging.thealliance.org` all answered `200`, so the health checks' stricter `200` requirement holds today.
- Rerun 2026-11-12 over both domains of each environment and production's `www.` hosts: `/api/`, both association files and `/events/static/array.js` on `worldalliance.org`, `thealliance.org`, `staging.worldalliance.org`, `staging.thealliance.org`, `www.worldalliance.org` and `www.thealliance.org`, 24 URLs in all, each answered `200`.
- The certificate served on `staging.thealliance.org` is the `staging.worldalliance.org` lineage (subject CN), covering both staging names. Whether a `staging.thealliance.org` lineage exists on the box can't be seen from outside; the new deploy check reports it.

## Vendor requirements

Vendor documentation, read 2026-11-12.

- Apple, [Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains): "You must host the file using https:// with a valid certificate and with no redirects."
- Android, [Configure assetlinks.json](https://developer.android.com/training/app-links/configure-assetlinks): "The assetlinks.json file must be accessible without any redirects (no 301 or 302 redirects)."

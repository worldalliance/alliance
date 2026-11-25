# Evidence

## Research (checked 2026-11-23, by a researcher subagent and the session agent)

- posthog-js `capture_pageview: 'history_change'` captures a page view on each History API path change and is the default from `defaults: '2025-05-24'`. Later `defaults` dates also turn on `session_recording.streamNetworkBody` (from `2026-06-25`). Vendor recommendation: https://posthog.com/docs/libraries/js/config
- PostHog path cleaning normalises dynamic URLs with regex rules set in project settings. Vendor recommendation: https://posthog.com/docs/web-analytics/path-cleaning. Sending a route template from the client isn't described in PostHog's docs.
- Session replay masks inputs by default but not other text. `maskTextSelector: "*"` masks all text. The docs don't cover whether to record internal tools. Vendor recommendation: https://posthog.com/docs/session-replay/privacy
- PostHog recommends separate projects for development, staging and production, and extra projects need a paid plan. Vendor recommendation: https://posthog.com/docs/data/environments
- Internal-user filters work on analysis only, and `distinct_id` links events to a person. Vendor recommendation: https://posthog.com/docs/data/test-accounts, https://posthog.com/docs/product-analytics/best-practices

### Reporting errors React Router catches (checked 2026-11-24, by a researcher subagent and a Codex second opinion)

- React Router says `ErrorBoundary` isn't enough for reporting errors, and for the browser recommends an `onError` prop on `HydratedRouter` or `RouterProvider`, called whenever React Router catches an error on the client. Vendor recommendation: https://reactrouter.com/7.13.2/how-to/error-reporting
- Sentry's React Router guide passes its reporter as `HydratedRouter`'s `onError`. Vendor recommendation: https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup/
- PostHog's React Router guide calls `captureException` in the root `ErrorBoundary` instead, and doesn't mention `onError` or skipping not-found responses. Vendor recommendation: https://posthog.com/docs/libraries/react-router/react-router-v7-framework-mode
- In react-router 7.13.2, `HydratedRouter` passes `onError` to `RouterProvider`; render errors reach it through `componentDidCatch` and loader errors through the router's new errors, with no status filter, so a thrown 404 response and an unmatched URL reach it too. Its route field is named `unstable_pattern`. Read from `node_modules/react-router` source and checked with an in-memory router.

## Admin traffic before this change (measured 2026-11-23)

- PostHog production project, HogQL over 90 days: 5 `$pageview` events on `admin.thealliance.org` from 3 people, all on 2026-08-31, against about 34,000 on the member site's hosts.
- Prometheus on the monitoring host, `sum by (route, method) (increase(http_request_duration_seconds_count[15d]))`, joined with the `AdminGuard`-protected routes parsed from `server/src/**/*.controller.ts`. Top admin-only routes: `/mms-threads/needs-reply` 4,309 (sidebar poll), `/user/groupAssignment/members` 1,274 and `/action-partnerships/responses` 1,263 (both sidebar), `/actions/all` 1,104, `/tasks/listForms` 1,063, `/tasks/adminForm/:id` 1,014, `/actions/adminslug/:id` 903, each stats-page `/analytics/*` chart about 263, `/user/userdetail/:id` 101. Sidebar and shared endpoints make these a rough proxy for page visits at best.

## Browser run against a production build (2026-11-23, posthog-js 1.364.6, Chromium via Playwright)

Method: `react-router build` of `apps/admin`, served on the admin port by a Bun script that answered `/config.json` with a synthetic PostHog key, proxied `/api/` to the local API, and recorded every request to a fake PostHog host. Playwright, signed in as a local admin, opened `/forms/3?search=Ada%20Lovelace`, `/member/12` and then `/members`.

- posthog-js sends nothing from a browser it judges a bot. Headless Chromium's user agent and `navigator.webdriver` both count, so the run overrode both.
- The first run sent the raw entry URL, query string included, in the `/flags` request's `person_properties`, which `before_send` never sees. With `advanced_disable_flags` there was no flags request, and no recorded request contained `forms/3`, `member/12`, `Lovelace` or `search=`.
- Page views, page leaves, `$identify` and `$exception` events carried `/forms/:formId`, `/member/:userId` and `/members` in `$current_url` and `$pathname`, `$prev_pageview_pathname` carried the previous template, and events after sign-in carried distinct id `7`, the admin's user id.
- Before super-properties were re-registered after `reset()`, the `$pageleave` sent after the sidebar's sign-out had no `app` property. Afterwards every event carried `app: admin`.
- The run was on `localhost`, which has no parent domain, so it didn't test cookie sharing with the member site.

## Library behaviour read from source (2026-11-23, react-router 7.13.2, posthog-js 1.364.6)

- `matchRoutes` returns a pathname decoded segment by segment with `/` re-encoded as `%2F`, and params taken from it with `%2F` turned back into `/`: `/forms/a%2520b` gives pathname `/forms/a%20b` and `formId` `a%20b`; `/forms/a%2Fb` gives `/forms/a%2Fb` and `a/b`; a malformed encoding stays raw in both. Run with `matchRoutes` in Bun.
- posthog-js names its store `ph_<token>_posthog` (`posthog-persistence.js`). Under `localStorage+cookie`, the cookie holds the distinct id, device id, session id, initial person info and user state, and `document.cookie`'s first match is read and overlaid by localStorage (`storage.js`). `identify()` sends the anonymous-to-known `$identify` only from an anonymous state, and sets `$user_state` to `identified`. `persistence_name` renames the store `ph_<persistence_name>`, and when the chosen storage's probe fails it falls back to the cookie.
- posthog-js lists `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gad_source`, `mc_cid` and the click ids `gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `twclid`, `li_fat_id`, `igshid`, `ttclid`, `rdt_cid`, `epik`, `qclid`, `sccid`, `irclid`, `_kx` as campaign parameters. It reads them from the page URL's query into event properties and `$initial_*` person properties (under `save_campaign_params`), and into `$session_entry_*` properties regardless. `ph_keyword`, the search term from a search engine referrer, goes into event and `$session_entry_*` properties.

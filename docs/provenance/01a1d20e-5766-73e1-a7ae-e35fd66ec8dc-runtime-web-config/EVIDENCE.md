# Evidence

The research behind runtime config is in `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed/EVIDENCE.md`, "Runtime config for web bundles". This file holds the measurements this task's decisions rest on.

## Production builds carry no environment's config

Method, 2026-11-12, Bun 1.4.4, Vite 6, React Router 7.13.2: built both apps with no `--mode` (`bun run build`, with `VITE_APP_GIT_SHA` set for the frontend), then searched `build/client`, source maps included, for both environments' PostHog keys (`phc_`), the PostHog host URLs and `deployed-config`.

- Neither app's client assets or source maps contain a PostHog key, `deployedConfigFor`'s values or `deployed-config.ts`. The only domain strings left are the constants `common/src/url.ts` already ships.
- The frontend's server build keeps `webRuntimeConfigFor(process.env.NODE_ENV)` as a runtime read. Vite didn't replace `NODE_ENV` in the SSR build. Loading it with `NODE_ENV=bogus` throws "Invalid web runtime config".
- The build no longer writes `build/client/index.html` or `build/client/guide/index.html`. Before the change, a staging build wrote both.

## One build, two environments

Method, 2026-11-12: ran the one frontend build with `NODE_ENV=staging node server.js` and then with `NODE_ENV=production`, and fetched `/`.

- Staging's HTML carried staging's PostHog key and `https://staging.thealliance.org/events/`. Production's carried production's key.
- In headless Chromium, `/`, `/guide` and `/login` hydrated against the staging server with no page or console errors.
- A document `POST /login` to the staging server (2026-11-13) answers 405, and its page hydrates to "405 Method Not Allowed" with no page errors. Before the root `meta` and `Layout` checked for the loader's config, it hydrated to "Application Error" from reading the config before it was loaded.
- Admin's build, served with a valid `config.json`, rendered the panel. With a 404 or a config missing the deployed values, it rendered the error screen.

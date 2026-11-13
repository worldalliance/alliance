---
user: Charles Lien
task: Implement ALL-2165, making the frontend and admin bundles environment-neutral with runtime config, as a PR from the `ci` branch.
---

# Requirements

This is the fourth planned PR of `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. Its requirements are that task's "Web bundles and runtime config" section, approved there by the user from a research recommendation, restated here:

- **One build serves both environments.** The frontend and admin bundles carry no environment's config, so the exact build staging ran can ship to production.
- **The frontend gets its config from its server.** The SSR server builds the config at request time and passes it to the client through the root loader. URLs stay same-origin.
- **`/` and `/guide` are no longer prerendered.** They render on request like every other page.
- **Admin reads a `config.json`:**
  - generated per environment at deploy time, outside the hashed bundle;
  - fetched before the app mounts and validated with zod, sharing the schema family in `common/src/web-env.ts`;
  - fetched with a bounded timeout, any failure showing a visible error screen, with no fallback environment;
  - served by nginx at an exact location that returns a real 404 when the file is missing, with `Cache-Control: no-cache`;
  - served by Vite middleware in development.
- **Admin's `index.html` gets a `Cache-Control` header** so browsers revalidate it after a deploy.
- **The `app_version` PostHog property is removed:**
  - `git_sha` stays as the version and the PostHog release identity;
  - an `environment` property comes from the runtime config;
  - the old persisted `app_version` super-property is unregistered.

The work ships as a PR from the `ci` branch (user).

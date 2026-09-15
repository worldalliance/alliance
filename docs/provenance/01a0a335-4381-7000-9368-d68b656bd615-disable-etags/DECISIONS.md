---
user: Charles Lien
task: Stop iOS from handing the mobile app an empty body on revalidated API responses
---

## ETags off on the server, not in the mobile client

A client-side fix only reaches new builds. Turning ETags off server-wide also
covers app versions already installed. The cost is that web and admin lose 304s
and re-download unchanged GET responses, which is bandwidth and nothing worse.

Measured against the e2e test app: with Express's default weak ETag, `/auth/me`
answered `If-None-Match` with a 304 and `Content-Length: 0`. `@hey-api/client-fetch`
turns an ok response with `Content-Length: "0"` into `data: {}`, so the login
flow saw no `user`.

## One `configureApp` for `main.ts` and `createTestApp`

A review found that the ETag regression test ran only against `createTestApp`,
so dropping the setting from `main.ts` would leave the test green.
`server/src/utils/configure-app.ts` now holds the setup both apps already did:
body parsers, the validation pipe, `cookie-parser`, and `etag` off. Removing the
setting from it fails `auth.bearer.e2e-spec.ts` ("sends no ETag for a client to
revalidate"), which I checked by deleting the line and running the test.

In `main.ts`, `cookie-parser` now registers before the `requestContext`
middleware instead of after it. `cookie-parser` calls `next()` synchronously, so
everything after it still runs inside the request context. Body parsers keep
their place ahead of that middleware.

The rest of `bootstrap()` (global guard and interceptor, the `requestContext`
middleware, CORS, the socket adapter, `trust proxy`) stays out of
`configureApp`. Moving it in would change what the e2e tests run, which is a
separate decision.

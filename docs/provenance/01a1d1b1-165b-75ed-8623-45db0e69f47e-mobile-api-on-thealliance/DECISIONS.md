# Decisions

- The production and staging API and analytics URLs derive from `ALLIANCE_DOMAIN` and `STAGING_SITE_URL` in `@alliance/common/url`, the constants `siteUrl` already uses, so the API host and the site host can't drift apart again. (agent decision)
- The mobile OAuth browser flow needs no change: the API returns the provider URL and the proof in its response body instead of a cookie, and the callback and return link derive from the server's `APP_URL` (`server/src/auth/oauth/mobile-browser-session.ts`, `server/src/auth/oauth/oauth-urls.ts`), so they don't depend on the host the app calls. The app's associated domains already list both domains (`apps/mobile/app.config.js`). (agent decision, reconstructed from existing code)
- The worldalliance.org URLs in `internalLinks.test.ts` and `oauthResult.test.ts` stay: they test that legacy links still resolve, which holds until ALL-2153. (agent decision)

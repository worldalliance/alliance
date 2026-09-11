# Decisions

## Renew the session in the client before navigating

Connect is a button rather than a link. It calls `authMe()` first, so the fetch wrapper in `shared/lib/hey-api.ts` refreshes a lapsed access cookie, then assigns `window.location` to the start URL. If the session can't be renewed, the fetch wrapper fires `auth:unauthorized` and AppLayout sends the member to sign in, as it does for any other request. The start URL is never opened. The row's session-expired copy only shows where nothing listens for that event, such as the component test.

Rejected for this commit: a server change that redirects a sessionless link start back to `returnTo` with an error instead of throwing. It would still tell a member whose refresh cookie is valid to sign in again, so it can't replace the client fix. It is also a separate, server-first commit, and the user asked only for the must-fix to be fixed.

Rejected: letting the link start accept the refresh cookie. It widens what a refresh token authorizes.

## The return URL comes from `window.location.origin` at click time

A click handler only runs after hydration, so the rows don't need `useAppOrigin(getBaseUrl())` the way the onboarding account step does. The rows read no config at render, so `SettingsPage.test.tsx` stubs none, and `OAuthAccountLinks.test.tsx` stubs only `getApiUrl`.

## The button stays enabled once navigation starts

`connecting` resets in `finally`. A page restored from the back/forward cache would otherwise come back with a dead "Connecting..." button. A second click during navigation just starts a second flow.

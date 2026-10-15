# Decisions

These are agent implementation decisions derived from [REQUIREMENTS.md](./REQUIREMENTS.md), not additional user-approved requirements.

## Authentication and production isolation

- `User.isTestUser` is a non-null boolean defaulting to false, added by migration `TestUser1792021897190`. No DTO picks it, so neither member nor admin payloads can read or set it (R2).
- `server/src/auth/review-account.ts` decides which deployments refuse review accounts: production does, and so does an unknown `NODE_ENV`, failing closed. Staging, development, and test authenticate them like any member, so staging never redirects them again.
- `sessionAccount` in `session.service.ts` adds `isTestUser: false` to the session lookup in refusing deployments. That one lookup backs `AuthGuard`, `AuthOptionalGuard`, `RefreshTokenGuard`, the admin and community-leader guards, `getAuthenticatedSession`, socket handshakes, and mobile OAuth handoff redemption. It runs on every authenticated request, so a flag set by a direct database edit ends existing sessions, impersonated ones included, with no token change. The HTTP guards refuse with 401s, so clients take their existing sign-out path; handoff redemption fails as `OAuthError.Failed`, and socket handshakes are rejected.
- In production, `AuthService.login` checks the password first, then refuses a flagged account with a 403 whose message is `REVIEW_ACCOUNT_MESSAGE` (`common/src/review-account.ts`). The refusal happens before the guest merge and the login analytics, so production issues no session and records no login; error tracking still captures the 403 like any other. A wrong password keeps the ordinary 401, so the 403 discloses only what a correct password already proves. Clients match on the message, the same pattern `ACCOUNT_MOVED_MESSAGE` uses, so the contract needs no new response type; its wording is frozen once a client that matches it ships. An older client shows its generic failure copy.
- Production's provider sign-in refuses a flagged account with `OAuthError.ReviewAccount` before linking a provider or updating anything (R3).
- Production refuses to impersonate a flagged account with a 403 of its own, before signing anything, so the admin keeps their own session instead of landing on cookies every guard rejects.
- In production, `forgotPassword` silently skips flagged accounts and `resetPassword` refuses them. A reset in production would change the hash that the nightly sync copies to staging, so the store-listed credentials would stop working. Staging's own reset flow is unchanged. Production credential changes stay with operators.
- `getAuthenticatedSession` returns null for a refused review session, so `submitPublicForm` treats the request as a guest's. That records only guest-owned data, the same as any signed-out visitor, and changes no member's notifications or displays (R1). It is left unchanged.
- Socket connections already open when an account is flagged are not swept. The member sockets only receive, and every write goes over HTTP, which refuses the session at once. The client then signs out and closes its sockets. When the database is down, the messaging socket handshake still accepts a verified token, as before; such a socket can still only receive.

## Web sign-in

- On the 403, the production login form (`AccountStep`) posts the email and password to `${STAGING_SITE_URL}/api/auth/review-login` as a top-level form submission (`apps/frontend/src/lib/reviewSignIn.ts`). From the legacy domain staging is cross-site, and only a top-level navigation can set its cookies there. The password travels in the POST body only.
- Staging's `POST /auth/review-login` (`AuthController.reviewLogin`) accepts only flagged accounts and refuses outright where review accounts are refused. That limits a login-CSRF post to the review accounts themselves. On success it records the login in analytics like any sign-in, sets staging's cookie session, and redirects (303) to `/tasks`. On a rejected sign-in (an account not yet copied, a credential mismatch) it redirects to `/login?reviewSignInFailed=1`, and the login page shows `REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE` until the next submit, stripping the parameter so a reload doesn't replay it. Any other error from the sign-in itself, such as a database failure, is logged and takes the same redirect, since a JSON error body would strand the reviewer mid-navigation. The throttle's 429 is still a JSON response. A staging outage shows the browser's own error, because the form post leaves production's page. The endpoint takes the per-IP provider sign-in throttle (`OAUTH_THROTTLE`).
- Logout on staging stays on staging, through the existing `/login` redirect. Visiting production starts production's login.

## Mobile environment

- `requestSession` (`apps/mobile/lib/reviewSignIn.ts`) signs in against the binary's deployment. On `ReviewAccountError` it repeats the same credentials against the fixed `STAGING` release target, without the guest token: staging can't verify production's guest token, and the guest's work stays with production. A failed staging token request becomes `ReviewSignInUnavailableError`, which shows `REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE` and is reported unless staging was unreachable. A failure after staging issues tokens, such as the profile load, takes the ordinary sign-in failure path.
- `setReviewSession` in `config.ts` switches `getApiUrl`, `getSiteUrl`, `getBaseUrl`, and `getWebSocketUrl` to staging, and updates the client's `baseUrl`. Media, uploads, sockets, and generated Alliance links all read these functions at use time, so they follow the switch. App identity, the OTA channel, and in-app link routing don't change. A link the app routes internally stays on the session's API.
- The marker is the `REVIEW_SESSION` secure-storage key. A review save first clears the earlier session's tokens, then writes the marker; an ordinary save first clears the marker. Each clear is read back before the new tokens land, so a production token is never marked for staging. An ordinary save overwrites a token the keychain kept: unmarked, it only reaches the binary's deployment, which refuses a staging one. Logout clears the marker only after the tokens are gone (`clearMarkedSession`), and logs rather than fails when only the marker survives, since a marker without tokens restores nothing. Launch reads it before restoring the session, and drops the read when a login or logout overtakes it; a read failure leaves the session unavailable rather than guessing an environment. `lib/sessionMarker.ts` owns the write, clear, and read order. Stored sessions without the marker use the binary's target.
- `startSession` switches the environment before `openSession` loads the profile, and switches back if the open fails (`openMarkedSession`). `closeSession` starts the logout request against the session's deployment, which captures its `baseUrl` when called, and only then runs the switch back it is handed. The query cache clears on both paths, and the existing session counter discards late token refreshes and restores.
- Device registration keeps one link per environment (`registeredDevice.ts`). The review link stores its state under `review.`-prefixed secure-storage keys and always calls staging. The active session's link handles register and unregister, so a stored production device id never stands in for, or unlinks, a staging one. A retry runs both links, so an unlink left pending by the other deployment's session still lands. An unlink sends no session token, since it may reach the other deployment and the endpoint is public.
- Mobile analytics stay on the binary's PostHog project, identified by the same user id. Staging copies production's ids, so it is the same person. Switching projects would mean remounting the provider above `AuthProvider`. The production server records no login for review sign-ins.

## Refresh and account lifecycle

- `sync_prod_to_staging.sh` collects the flagged ids into a temp table before anonymizing emails and passwords. Those rows keep prod's email and password hash; every other anonymization step, phone numbers and push-token pruning included, still runs on them. The column check treats a snapshot from before prod gained the column as having no review accounts (R4).
- The anonymize step runs as a single transaction with `ON_ERROR_STOP`, so any failure aborts before the swap. No separate validation step was added: the only new logic is the exclusion list.
- A nightly reset restores the snapshot, including historical activity left under R6. Designation and production credential edits reach staging at the next successful sync; until then staging refuses the review sign-in with the unavailable message. Removing the flag restores production eligibility. An open staging session stays on staging until logout or ordinary expiry.
- Staging's notification switches, queues, and pruning are unchanged (R5).

## Failure messages

- Account not yet copied or credential mismatch after production accepted the password, and on mobile also staging unavailable: "Review sign-in is temporarily unavailable. Please try again later."
- Provider sign-in for a flagged account in production: "Use your review account's email and password to sign in."
- `REVIEW_ACCOUNT_MESSAGE`, the 403 that clients match on: "This review account requires an updated app or the staging website." Older clients show their generic failure copy instead.

## Delivery and review instructions

- Deploy the server and the clients before flagging accounts; the mobile change is JS-only and can ship over OTA. Then flag the accounts by hand, run or wait for a staging sync, and only then hand over access.
- Production and staging must use different `JWT_SECRET` and `JWT_REFRESH_SECRET` values for each to reject the other's tokens. Verify this on the hosts without recording the values; the code cannot check it.
- Store-review instructions should say the account runs against staging, its activity resets nightly, and it signs in through the ordinary email/password form. The platform references are [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google sign-in details requirements](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-EN).

## Verification

- `server/test/review-account.e2e-spec.ts`: production login refusal, ordinary login, sessions ended by a database flag, socket handshake, password reset and reset email, provider sign-in by email and through a linked provider, a provider handoff redeemed after flagging, impersonation, and the staging handoff's success, login analytics, rejection, and logged-failure paths. Removing the session rule fails the flag and socket tests.
- `server/src/auth/review-account.spec.ts`: which `NODE_ENV` values refuse review accounts.
- `apps/mobile/lib/reviewSignIn.test.ts`: ordinary sign-in clearing the guest token, staging sign-in without sending or clearing it, staging failures, and other refusals.
- `apps/mobile/lib/deviceLink.test.ts`: device-link routing per deployment, and retries across both.
- `apps/mobile/lib/session.test.ts`: a logout reaching the session's deployment before the switch back.
- `apps/mobile/lib/config.test.ts`: the URLs and client a review session switches to staging, and back.
- `apps/mobile/lib/registeredDevice.test.ts`: each session's unlink reaching its own deployment with its own stored device, without the session's token, and a review session registering on staging.
- `apps/mobile/lib/sessionMarker.test.ts`: the marker written before the tokens, cleared after them, and read before them at launch, a save refusing to go past a token or marker delete the keychain ignored where it matters, including a failed read and a logout that overtakes it; a new session routed before it opens and back when it fails.
- `server/test/auth.throttle.e2e-spec.ts`: the review handoff's rate limit.
- `apps/frontend/src/onboarding/AccountStep.test.tsx`: the form post to staging, and the failure message.
- The anonymize SQL was run against disposable copies of the local database, with and without the column: flagged rows keep their email and hash, everything else is anonymized.
- Not yet exercised: the full flow on iOS/Android devices and the deployed web hosts.

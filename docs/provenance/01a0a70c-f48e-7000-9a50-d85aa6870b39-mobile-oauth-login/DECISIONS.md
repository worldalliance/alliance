# Decisions

## Native provider UI

- Google on iOS and Android goes through `@react-native-google-signin/google-signin`. Its id token carries the web client id as audience, which `GoogleOAuthClient.verifyIdentityToken` already checks against `GOOGLE_CLIENT_ID`.
- Apple on iOS goes through `expo-apple-authentication`. `AppleOAuthClient.verifyIdentityToken` checks the token against `APPLE_BUNDLE_ID`, so the dev bundle id has to be in that comma-separated list.
- Android has no native Apple UI, so Apple there uses the browser session. Google also falls back to it when Google Play services are missing, since the native SDK can't run without them.
- The app requests only Apple's email scope. Mobile sign-in never creates an account, so a name has no use.
- A request that never gets a response (React Native's fetch rejects with a `TypeError`) counts as a network failure. Any other rejection counts as `failed`.
- The app signs out of the Google SDK after every attempt. Otherwise the SDK reuses the account it just picked, and a member told "no account found" can't choose a different Google account.

## Server

- A new `OAuthAuthService.signIn` holds the "existing provider identity, else matching verified email" half of `authenticate`. `authenticate` calls it and then creates an account when there is an invite. The mobile endpoints only call `signIn`, so no mobile path can reach account creation.
- `authenticate` creates an account whenever the state carries a referral code that resolves, which is a one-time invite, a campaign code, or a member's referral link. That is the web signup rule already, and REQUIREMENTS.md's "requires an invite" is read as "requires one of those" rather than as a narrowing of the web flow. The e2e test pins the one-time invite case, including that the invite is spent.
- `POST /auth/:provider/native` takes a native id token and answers with tokens or an `OAuthError` in a 200 body. No account, an unverified email, and a conflict are outcomes the app branches on, and the generated client throws on non-2xx.
- The browser fallback reuses the web callback:
  - `POST /auth/:provider/native/browser` mints the proof and returns it with the consent URL. The state records `origin: app`.
  - The callback skips the cookie check for app flows, because a system browser session shares no cookies with the app. It signs in, then redirects to `alliance://oauth-callback` with a short-lived signed handoff (user id, provider, outcome, proof hash) or an `error`.
  - `POST /auth/:provider/native/redeem` issues tokens only to the caller holding the matching proof. Another app that registers the `alliance` scheme and catches the redirect gets a handoff it can't redeem.
- The app deep link is a server constant, not a client parameter, so the app flow can't become an open redirect.
- The handoff is stateless and good for 5 minutes. The proof holder could redeem it twice within that window, which only gives them a second session for an account they just signed into.
- The browser flow's redirect URI is the web app's origin (`APP_URL`) under `/api` when deployed, which is already registered with both providers. In development it is the request origin, same as the web flow. Providers will refuse a LAN IP, so the browser fallback only works deployed or against localhost.
- An app-flow state that fails only on expiry sends the app `error=expired` rather than the web login page. Web flows keep their existing behavior.
- `OAuthError.Expired` is new in `common/src/oauth.ts`. Web never emits it but its message record needs an entry.
- The callback treats any state whose `origin` isn't `app` as a web flow, cookie check included. A state minted before this deploy has no `origin`, so it finishes as the web flow it is.
- The redeem endpoint answers `failed` when the handoff's user no longer exists.
- The server accepts a native id token more than once. On Android, `@react-native-google-signin/google-signin` 16.1.5 signs in through Play services' legacy `GoogleSignInClient`, which is expected to return the same cached id token until it expires (not yet checked on a device). Refusing a repeat would then fail a member who logs out and back in within the hour, and every retry after it. The replay it would prevent exposes nothing new: the same response carries a 1-day access token and a 30-day refresh token, and the server logs no request bodies.
- Neither native id token carries a nonce. The app would send it alongside the token it is stamped into, leaving the server to compare a value to itself, and `@react-native-google-signin/google-signin` has no nonce outside its paid tier anyway.

## Login surface

- `/onboarding` (the `WelcomeGate`) is the one login screen. The provider buttons are white, with Google's four-color mark and Apple's black logo, to match the gate's existing white "Log in" button on the photo. The unauthenticated redirect and logout already land there. `app/auth/login.tsx` is deleted, and the one link to it (the action page's "Log in to complete this task") points at `/onboarding`. `skills/playwright/MOBILE.md` named the old route and now names `/onboarding`.
- Provider buttons show only in `AccountMode.LogIn`. The dormant sign-up mode stays untouched.
- The email field no longer autofocuses. With provider buttons above it, an open keyboard would push them and the title off small screens.
- Cancellation shows in the gate's existing neutral `notice` line. Failures use its `error` line. The buttons stay enabled afterwards, so a retry is one tap.
- `expo-router` would treat `alliance://oauth-callback` as a route. `app/+native-intent.tsx` returns `null` for it, which leaves the login screen mounted while `expo-web-browser` reads the URL.

## Copy

Mobile-only wording, in `apps/mobile/lib/oauth.ts`:

- No account: names the other ways in on the same screen (another Google or Apple account, email and password). The web copy tells the member to ask for an invite link, which reads as a signup pointer.
- Provider already connected: the web copy says "Disconnect that one first", but mobile has no disconnect control. Mobile tells the member to use the connected account or their password.
- Network: "We couldn't reach the Alliance. Check your connection and try again."

The rest reuse `oauthErrorMessage`.

## Configuration

- The Google web and iOS client ids the user supplied are constants in `apps/mobile/lib/oauth.ts`, not env vars. They ship inside the app binary anyway, and a missing env var would break every prebuild and dev server.
- Dev and production builds have separate iOS clients. The app picks one by `Application.applicationId`, and `app.config.js` picks the matching reversed id as the URL scheme by `APP_VARIANT`. An unknown bundle id fails the Google attempt with `failed` and logs the id.
- The app never names the Android client ids. Google matches Android clients on package name and signing certificate.
- The deployed browser fallback redirects to `APP_URL`'s host. Both providers list that host's `/api/auth/<provider>/callback` for the production and staging domains, so `APP_URL` must stay one of the registered hosts.

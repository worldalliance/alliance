# Settings OAuth connections

## Approved agent proposals

All nine decisions below were proposed by the agent and approved together by the user. Their acceptance is recorded in [REQUIREMENTS.md](REQUIREMENTS.md).

### 1. Providers and availability

Expose Google and Apple connections to every signed-in member in web, iOS, and Android settings. Admin settings are outside this feature. Supporting the existing providers on each member platform gives members the same account-management capabilities wherever they use Alliance.

### 2. Account section

Place password controls and a Connected accounts list in Account. Each provider has a row with its icon and name, a Connect action when disconnected, and its connected email address and a Disconnect action when connected. Move mobile password controls into an Account section separate from Privacy. This groups sign-in methods together and makes the identity being disconnected visible.

### 3. Identity and email

A member may connect a verified provider identity whose email differs from their Alliance email, including an Apple private-relay address. Preserve the Alliance email. Reject an identity already linked to another Alliance member and explain the conflict; do not merge accounts. Connection adds a way to access the current account, rather than choosing an Alliance account by email.

### 4. Replacing a connection

Permit one connected identity per provider. Require disconnection before connecting a different identity for that provider, with the last-sign-in-method restriction still applying. This avoids silently replacing an existing way into the account.

### 5. Disconnection and lockout protection

Require a confirmation naming the provider before disconnecting it. Disable Disconnect when the provider is the member's only sign-in method, and explain that they must set a password or connect the other provider first. Enforce this restriction on the server even when the UI has stale data or requests overlap. Confirmation makes the consequence explicit; server enforcement prevents lockout.

### 6. Password access

Show Set password when the member has no password and Reset password otherwise. Both use the existing email reset flow addressed to the Alliance account email. Display request progress, success, and retryable failure feedback. Sending the email does not count as setting a password; only a completed password change can unlock last-provider disconnection. Reusing recovery provides a path out of the restriction without a second password workflow.

### 7. Provider flow and return destination

On mobile, use native Google and Apple dialogs where supported and a system-browser session otherwise. Return to settings after linking. On web, redirect through the provider and return to the Account section. Match the existing platform sign-in experience while binding connection to the already signed-in Alliance member.

### 8. Authentication and sessions

The current authenticated Alliance session authorizes connecting and disconnecting; do not require re-entry of an existing Alliance credential. Connecting requires provider authentication. Preserve the current Alliance identity and its active sessions, including sessions on other devices. Linking must not execute a sign-in or account-creation flow, since its purpose is to add credentials to the current member.

### 9. Feedback and settings saves

After a completed change, refresh the displayed connections and disconnect eligibility immediately. Show inline success or an actionable failure with a retry path. Cancellation returns quietly to settings without changing the connection. Before a web provider redirect, finish pending settings saves; keep the member on settings if saving fails. This makes the result visible and prevents navigation from discarding an edit.

## Agent implementation guidance

These details derive from the approved behavior and code inspection; they were not separately proposed to the user.

- Reuse the existing OAuth account storage, provider verification, conflict checks, disconnect protection, and password recovery. No data migration or backfill is expected because connections and password presence are already represented.
- Add authenticated mobile linking for both native credentials and browser fallback. Bind browser completion to the initiating member and app proof; reject an invalid, expired, replayed, or mismatched completion. An account switch or logout during a mobile flow must not apply its result to another member.
- Keep account management separate from profile autosave. Updating authentication data must preserve mobile settings edits, and the web save gate must account for the latest edit, including a focused field or validation error.
- Show loading state while connection data is unavailable and while an operation is pending. Serialize connection mutations in the settings UI, and reconcile with server state after completion or an uncertain network result before allowing another mutation. Unknown status must not appear as disconnected or removable.
- Refresh account data on return to settings so a password set through email or a connection changed elsewhere updates disconnect eligibility. Preserve retryable errors for provider failure, unverified email, identity conflict, expired flow, network failure, and server rejection; cancellation alone is quiet.
- Keep callback notices scoped to the current attempt so reloads or subsequent navigation do not replay them. Treat a repeated connection to the same identity as an idempotent success.
- Changes to sign-in/sign-up behavior, account merging, provider configuration, email editing, and session revocation are outside this feature. This request adds settings management beyond the [earlier mobile-login task](../01a0a70c-f48e-7000-9a50-d85aa6870b39-mobile-oauth-login/)'s scope; its quiet cancellation behavior applies to settings linking only.

## Acceptance checks for implementation

The feature is complete when these checks pass on web, iOS, and Android, using native dialogs and browser fallback where applicable:

1. Members with zero, one, or two provider connections see the corresponding actions and connected emails in Account, alongside the correct password action.
2. Connecting either provider adds it to the current member, including when provider and Alliance emails differ, and preserves the Alliance email and signed-in identity.
3. Another member's linked identity, an unverified identity, and a different identity for an already-connected provider are rejected with actionable feedback and no connection replacement.
4. Disconnect confirmation can be cancelled. Confirmed disconnection succeeds when another provider or password remains. UI and server prevent removing the final method, including concurrent disconnections.
5. Set password and Reset password send recovery email and report success or failure. Merely sending a link leaves last-method protection active; completing password setup and returning to settings enables eligible disconnection.
6. Success refreshes status; cancellation returns quietly; failures permit retry. Reloads do not replay notices. A failed status refresh does not expose actions based on invented connection state.
7. Native and browser linking preserve existing sessions and never sign in as the selected provider's other Alliance account. Invalid, expired, replayed, or mismatched browser completions cannot link an identity.
8. Web linking waits for pending edits to save and returns to Account. Invalid edits or save failure prevent the redirect. Mobile linking and account-data refresh preserve in-progress settings edits.

Validate these behaviors with focused client and server tests and platform interaction checks during implementation.

## Implementation decisions

Made by the implementing agent; not proposed to the user.

- **Web linking reuses the existing flow.** `GET /auth/:provider/start?intent=link` already bound the flow to the cookie session and the browser's proof cookie and wrote at the callback, and `DELETE /auth/:provider/link` already enforced last-method protection under a row lock. Beyond the impersonation refusal below, the server work for linking is mobile-only.
- **Mobile browser linking writes at redeem, not at the callback.** The callback runs `linkable` so a refusal reaches the app from the return link, then signs a link handoff naming the identity. `POST /auth/:provider/link/redeem` links it only with the app's proof and only for the member in the handoff. Writing at the callback would let anyone who finishes a consent URL attach their identity to the member who started it.
- **The link handoff has its own token type** (`oauth_link_handoff`), so neither handoff redeems at the other's endpoint.
- **The link handoff encrypts the identity.** It rides the return link's query string, which browser history and the web host's logs can record, so the provider subject and email go in as a JWE under a key derived from `JWT_SECRET`, and only redeem reads them.
- **The native link body carries `userId`.** The server refuses it unless it matches the authenticated member, which is how a logout or account switch during the sheet can't apply the identity to another member. It is a check, never an authority.
- **No linking or unlinking while impersonating.** An admin impersonating a member holds that member's session, and a link connects whichever provider account the admin's browser is signed into, which then signs in as the member after impersonation ends. Web start with `intent=link`, every `OAuthLinkController` route, and `DELETE /auth/:provider/link` answer 403 to an impersonated session (`refuseImpersonation` in `server/src/auth/tokens.ts`, `NotImpersonatingGuard`). Web settings disables every connection control while impersonating and says why, rather than letting Connect land on the 403. Mobile has no impersonation.
- **Link endpoints live in `OAuthLinkController`.** `oauth.controller.ts` was already past the 500-line guideline.
- **Connection state comes from its own query** (`useSignInMethods`, `shared/lib/signInMethods.ts`), not from the auth context's user. The mobile `refreshUser` swallows failures and keeps the old user, which would show stale state as current; the query exposes the failure, and the settings form stays seeded once, so reloads never touch in-progress edits. After each change the hook stores the server's answer, refetches, and reports busy until the refetch lands; a failed load renders no connection state.
- **Web save gate.** `LEAVE_SETTINGS` in `apps/frontend/src/components/settings/AccountSettings.tsx` maps the autosave status to go, wait, or stop. Clicking Connect blurs a focused phone field, so an invalid number reads as `blocked` and stops the redirect.
- **Web Connect refreshes the session before redirecting.** The start endpoint accepts only the access cookie, which lasts 30 minutes, and a top-level navigation skips the client's refresh on a 401. Without a `POST /auth/refresh` first, a page left open that long lands on a bare 401 JSON page. A refused refresh keeps the member on settings with the refusal.
- **Refresh on return.** Web relies on react-query's refetch on window focus, covered by a test that fails with it turned off; mobile refetches on screen focus and when the app becomes active.
- **Copy.** The password link and disconnect wording lives once, in `passwordLink` and `disconnectAccount` (`shared/lib/copy.ts`), for web and mobile. Refusals reuse `OAUTH_ERROR_MESSAGE`, whose "Disconnect that one first" fits settings. Mobile sign-in's override of that message points at sign-in, so linking doesn't use it.
- **Interrupted Android browser links open settings and say so.** When Android kills the app during the browser session, the handoff is never redeemed, so nothing links. The return link cold-starts the app and routes to onboarding, which sends a signed-in member to settings with the `oauthInterrupted` reason, and the Account section shows `interruptedLinkFeedback` (`apps/mobile/lib/oauthLink.ts`). A signed-in member opens a browser session only to connect, so the return link doesn't need to name its flow.
- **A link's Auth Tab keeps its own interrupted-tab marker.** `AuthTabFlow` in `apps/mobile/lib/oauthResult.ts` keys the marker per flow, so onboarding never reads a cut-off link as an unfinished sign-in. The sign-in key is unchanged, so markers already on devices still read. `useInterruptedLinkRedirect` takes the link marker when the signed-in app starts and opens settings with the same message.
- **The password email says set or reset to match the member.** Set password sends the forgot-password email, which said "reset your password" to a member who never had one. `forgotPassword` passes whether the member has a password, and the subject and body follow it. That check is `hasPassword` in `user.entity.ts`, which `UserDto` and the last-sign-in-method guard on disconnect also use, so the Settings buttons, the disconnect rule, and the email can't disagree.
- **The page the password email opens says saved.** It said "Password reset successful!" and can't tell whether the member had a password, so it says saved for both.
- **`/login` shows the message the password page hands it.** The onboarding flow took over `/login` and stopped reading that message, so a member who set a password from Settings landed with no sign it worked. The password page checks what it sends against `LoginNotice`, so renaming the field on either side fails the build.
- **OAuth failures report as `oauth_failed`, not `oauth_sign_in_failed`.** Mobile linking reports through the sign-in helpers, which tagged every failure as a sign-in. PostHog queries on the old name must match both until older app versions update. Slack alerts are unaffected.
- **Provider failure copy doesn't name sign-in.** Settings shows `OAUTH_ERROR_MESSAGE` when connecting, so Failed and Expired name neither the action nor the provider: Failed is mostly our own errors, and Expired is one of our tokens running out. Cancelled still says sign-in, since settings stays quiet on a cancellation.
- **The return-notice strip keeps `#account`.** `useOAuthNotice` strips the query with `navigate` rather than `setSearchParams`, which drops the hash, so a reload after returning still opens Account.

## Verification

- Server e2e: `server/test/oauth-link.e2e-spec.ts` (22 tests) and the existing `oauth.e2e-spec.ts` pass. Removing the member-binding checks fails the two mismatch tests. The impersonation tests fail without the refusal: start redirects to the provider, and unlink and every mobile link route answer 200.
- Unit and component tests: `shared/lib/signInMethods.test.tsx`, `apps/frontend/src/components/settings/AccountSettings.test.tsx`, `apps/mobile/lib/oauthLink.test.ts`. Letting `saving` go straight to the redirect fails the save-gate test; skipping the session refresh fails both refresh tests.
- Browser: the web Account section and the mobile web build rendered for a synthetic passwordless member with Google connected, and web Connect reached `/auth/apple/start?intent=link` with the Account return URL and a redirect to Apple.
- Not run: real provider consent, native sheets on iOS and Android devices, and the Android Auth Tab.

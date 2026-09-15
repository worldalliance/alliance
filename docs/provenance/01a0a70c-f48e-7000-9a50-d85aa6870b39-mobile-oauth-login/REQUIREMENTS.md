---
user: Charles Lien
task: Add OAuth login to the mobile app
---

## Goal

- Let members log in to the mobile app with Google or Apple.
- Optimize for the best user experience, even when the work requires a mobile deploy.

## Platforms and providers

- Ship Google and Apple login on both iOS and Android in the same mobile release.
- Use native provider UI wherever the platform supports it. Use a secure system-browser session as the fallback.
- Leave the existing web OAuth flow unchanged.

## Account behavior

- Mobile OAuth is sign-in only. It must not create an account or start an account-creation journey.
- Account creation remains a web-only flow that requires an invite.
- A provider identity already connected to an Alliance account signs in to that account.
- When a provider returns a verified email matching an existing Alliance account, connect the provider to that account and sign in.
- Do not merge accounts when the provider email differs from the Alliance account email, including when Apple returns a private-relay address.
- When no Alliance account matches, keep the member on login, explain that no account was found, and offer Google, Apple, and email/password as the available alternatives. Do not offer mobile signup or a generic signup link.

## Login experience

- Keep email/password login and forgot-password recovery.
- Use one login surface throughout the mobile app. Put the provider buttons above the email/password fields with an "or continue with email" divider.
- A normal login from app launch lands on the app home screen.
- A provider cancellation returns to the same login screen with a neutral inline message.
- Provider, network, expired-flow, and account-conflict failures return to the same screen with an explicit, retryable inline message.

## Scope

- Do not add provider connect or disconnect controls to mobile settings.
- Do not activate the dormant mobile account-creation, narrative onboarding, or agreement screens.
- Work only from the current working tree. Do not inspect other branches.

## Provider configuration (supplied by the user mid-task)

- Apple: Sign in with Apple is enabled for `com.alliancefoundation.alliancemobile` (primary) and `com.alliancefoundation.alliancemobile.dev` (grouped with it). The Services ID is `org.thealliance.signin`. Its return URLs are `https://<host>/api/auth/apple/callback` for the production, `www.`, staging, and admin hosts of both domains. The server environments set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICES_ID`, `APPLE_BUNDLE_ID` (both bundle ids, comma-separated), and `APPLE_PRIVATE_KEY_BASE64` [redacted].
- Apple: Sign in with Apple for Email Communication is configured for thealliance.org and worldalliance.org, with senders alliance@thealliance.org and alliance@worldalliance.org. Only alliance@worldalliance.org is used today. User request: "could we ensure there's a note in the codebase that we need to configure it in the Apple UI?"
- Google: there is one Web client (`GOOGLE_CLIENT_ID`, with `GOOGLE_CLIENT_SECRET` [redacted]). Its redirect URIs are `/api/auth/google/callback` on the same hosts, plus `http://localhost:3005` `/auth/google/callback`.
- Google: there are iOS clients for the production and dev bundle ids, and Android clients for `com.alliance.alliancemobile` (Play and internal signing certificates) and `com.alliance.alliancemobile.dev`. The user supplied each client id.

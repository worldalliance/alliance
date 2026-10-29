# Implementation decisions

These are agent implementation choices for [the requirements](REQUIREMENTS.md), not additional user-approved requirements.

## Account ownership

Use a dedicated `KoraParticipant` entity (table `kora_participant`), with its own module in `server/src/kora/` and endpoints under `/kora`. Every class, table, cookie, and API schema carries the `Kora` prefix (R1), which also keeps it apart from messaging's `Participant` and `ParticipantDto` for conversation members. The OTP module stays generic (R8); only its purpose value, `kora_sign_in`, names Kora. Neither the Alliance `User` nor the anonymous `Guest` represents this identity: the former participates in membership flows, while the latter lacks a verified contact and reusable login. Keep the participant's stable ID as the eventual owner of their work; defer any member link until conversion is specified.

Store the name, normalized email or phone, nullable timezone, contact verification time, and creation time. Require exactly one contact, unique within participants. Normalize emails by trimming and comparing case-insensitively through a `citext` column, as `User.email` does; normalize phones to E.164 using the existing phone utilities. Do not collapse email aliases. Reuse the waitlist input bounds of 200 characters for names and 320 for email addresses. Trim names and reject blank values. Reuse `deviceTimeZone` / `signupTimeZone`; unavailable detection yields null without blocking signup, and later login may fill a missing timezone.

Use separate participant OAuth identities with unique `(provider, subject)` and `(participantId, provider)` pairs. Store provider identity metadata separately from the primary contact. This permits several methods for one verified email without adding a second contact.

Generate additive migrations for participant, challenge, rate-event, signup, and session storage, and identity storage with OAuth. Start with new registrations; do not infer participant records from existing waitlist, guest, or member data. Participant login performs no matching or merging against member accounts, even if a signed-out member enters the same contact.

## Flow and interface

Replace the project page's `WaitlistSignupForm` with `KoraSignIn`. Its email/phone parsing, country selector, and field state move to `components/projects/ContactInput.tsx` (`parseContact`, `ContactInput`, `useContactField`), which the waitlist form uses too. The waitlist form's closed mode served only this page and is removed with it. Keep Alliance waitlist browser memory, referrals, nominations, confirmation emails, and sharing links out of the participant flow. The existing participant-count display is outside this change.

The card renders from the cached `GET /kora/me` state, and each mutation writes its result into that cache, so a reload resumes at the same step. The member side comes from `useAuth`. Its bootstrap reads a failed member lookup as signed out, so only the participant lookup offers retry; a member whose lookup failed sees the participant form, which carries no member data.

`POST code` needs the contact itself, and the page holds it only in memory. Resend reuses it; after a reload, which forgets it, the code step hides resend and offers only “Change email or mobile number”. Changing the contact returns to contact entry with the typed value still filled in. A code the server calls no longer valid does the same, showing its copy there, since the code step after a reload has no resend to act on it. The code input uses `autocomplete="one-time-code"`, which Safari fills from the SMS, and asks WebOTP for SMS codes, which Chrome on Android requires. A refusal carrying a known `OtpError` or `KoraError` shows the server's copy at any status, including the 503 of a failed delivery; other failures use `thrownRefusalMessage`.

Use these states:

| State              | Behavior                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolving sessions | Reserve the card while member and participant session state loads. A lookup failure offers retry rather than treating an unknown session as signed out. |
| Active member      | Apply R2 before showing any participant state.                                                                                                          |
| Signed out         | Show “Email or mobile number”, “Continue”, “Continue with Google”, and “Continue with Apple”. The provider buttons arrive with OAuth (PR 5).            |
| Sending code       | Disable repeat submission; retain the entered contact.                                                                                                  |
| Awaiting code      | Show a masked destination, a six-digit input supporting paste/autofill, “Verify”, the resend countdown, and “Change email or mobile number”.            |
| Completing signup  | Show “Full name” and “Continue” after contact verification when a name is still required.                                                               |
| Signed in          | Show “You’re signed in as {name}.” and an icon control with the accessible name and tooltip “Sign out”.                                                 |

Changing the contact before signup abandons the current challenge and starts contact entry again; it is not an account contact-editing feature. Preserve entered values on retryable errors. Report errors inline with an accessible alert, focus the next required field, and keep the flow keyboard usable.

For OAuth, a supplied nonblank name completes a new registration; an email address is not a fallback name. Existing participant names and contacts are not overwritten from subsequent provider responses.

## OTP verification and completion

One-time codes live in a generic `server/src/otp/` module (R8): an `OtpPurpose` enum names each use, a `Record<OtpPurpose, …>` holds its wording, and challenges, digests, limits, and purging are shared. The module knows nothing of HTTP or participants; it returns a browser token that the caller stores in its own cookie. `otpRefusalException` maps its refusals to the copy below with the `OtpError` code from `common/src/otp.ts` in the response's `error` field.

Create the durable participant only after verified contact and a valid name are available. OTP success for an existing participant issues a session immediately. For a new participant needing a name, exchange verification for a browser-bound, single-use signup continuation valid for ten minutes. Expired continuations restart verification. OAuth uses the same completion path when its profile lacks a name.

Generate codes with a cryptographically secure random source, preserving leading zeros. Store an HMAC-SHA256 digest over the challenge ID, contact, and code, not plaintext or an unkeyed hash of the low-entropy code. Derive its key from `JWT_SECRET` with HKDF under a purpose label. Challenge handles must be unguessable and tied to the initiating browser; the code by itself is insufficient to select or authenticate an account.

Enforce expiry, attempts, resend, and consumption in the database so they survive restarts and concurrent requests. A challenge row exists only while its code is usable or exhausted: a new code, a successful verification (a conditional `DELETE … RETURNING`), a failed delivery, or the purge deletes it. Changing the contact deletes this browser's challenge and any signup awaiting a name. Verification, signup completion, and unique-contact resolution must allow only one successful consumption. Simultaneous verified signups for the same contact resolve to one participant, without letting the losing request overwrite the name. Resending invalidates the earlier challenge across browsers. Delivery failure invalidates the new challenge too; an older code is not restored.

Implement the following rate limits as initial operational defaults, distinct from the user-approved code rules in R5:

| Operation                         | Limit                                     |
| --------------------------------- | ----------------------------------------- |
| Code sends per normalized contact | 5 per rolling hour and 20 per rolling day |
| Code sends per IP                 | 30 per minute and 200 per hour            |
| Code verification per IP          | 30 per minute and 200 per hour            |

Keep these limits in the database rather than the in-memory `ThrottlerGuard`, so both contact and IP limits survive restarts and report a retry time. Each counted request is an `otp_rate_event` row whose bucket is a keyed digest of the contact or IP, so no contact or address is stored; an advisory lock per bucket makes check-and-count atomic. The sixty-second resend wait is checked under the same lock and refused as a throttle. The throttle copy formats `{time}` with `formatDistanceStrict`, rounding up. Count provider delivery attempts, including failures, against send limits. Apply contact limits across browsers. Resend and attempt counters must update atomically. Return a retry time for throttled requests. Hourly jobs purge challenges, continuations, and sessions once expired, and rate events once outside the longest window, so incomplete signups do not leave permanent contact records.

Before verification, responses must not disclose whether a participant exists. Distinguish usable actions after failures with these messages:

| Failure                                             | Copy/action                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Invalid contact                                     | “Enter a valid email address or mobile number.”                              |
| Wrong code with attempts remaining                  | “That code isn’t correct. Try again.”                                        |
| Expired, replaced, consumed, or exhausted challenge | “That code is no longer valid. Request a new code.”                          |
| Delivery failure or ambiguous delivery timeout      | “We couldn’t send your code. Try again later or use another sign-in method.” |
| Send/verification throttle                          | “Too many attempts. Try again in {time}.”                                    |
| Expired signup continuation                         | “Your verification has expired. Verify your contact again.”                  |
| Other request failure                               | “Something went wrong. Please try again.”                                    |

## OAuth isolation and matching

Reuse the existing Google/Apple protocol clients and browser-state protections. Add participant-specific start/callback handling; do not call the member `OAuthAuthService.authenticate` or `createReferredUser` paths. Provider redirects must return to the initiating allowed project host, and state/proof validation must bind the callback to this participant flow.

Resolve an existing provider/subject identity first. Otherwise match only a provider-verified email to a participant email, then attach the identity transactionally. If neither exists, begin participant signup. An existing provider subject remains attached to its participant even if the provider's email changes; this does not change the participant's primary contact or merge accounts. Reject a conflicting identity attachment instead of transferring ownership.

Provider cancellation returns to the usable form. A provider lacking a verified email is refused with an option to use OTP or another provider. Adapt the existing OAuth error messages so participant failures do not mention invitations, passwords, or member onboarding. Phone-only participants using an unrelated OAuth email create a separate account under R4; no matching by name occurs.

## Delivery infrastructure

Reuse the configured mail transport and Twilio infrastructure through `sendUnrecordedMail` (new `EmailType.OtpCode`, template `otp-code.pug`) and `sendUnrecordedText`, which keep R9's existing delivery gate. The current `MmsService.sendMms` requires a member ID and stores the message body; `MailService.sendMail` stores rendered HTML. Factor the necessary transport boundary for authentication messages rather than supplying fake member IDs or retaining plaintext OTPs in message archives. Keep authentication delivery out of member notification preferences, campaign attribution, and waitlist mail.

Retain operational delivery status and provider message IDs where needed, excluding codes, session tokens, and sensitive provider payloads from logs. Disabled or unavailable delivery must return an explicit unavailable result rather than pretending a code was sent. Tests use delivery stubs. Check sender support, Apple relay sender registration, and actual delivery during implementation verification; the existing credentials and provider account permissions have not been inspected for this spec.

## Participant sessions

Use opaque random session tokens stored only in a dedicated HttpOnly cookie (`kora_session`), with token digests, participant IDs, and expiry stored server-side. The challenge token and signup continuation ride in their own HttpOnly cookies (`kora_code`, `kora_signup`) lasting ten minutes. Use Secure cookies on deployed environments, and SameSite=Strict until the browser OAuth return needs Lax. Session-changing requests pass `AllowedOriginGuard`, which requires an `Origin` header naming one of the configured app origins: CORS reflects any origin, so the header check, not CORS, is what stops cross-site submission. Credentials are not stored in browser local storage or URLs.

Extend expiry and cookie lifetime on successful participant-authenticated requests, with no background keepalive loop. Reject expired sessions before extending them. Reauthentication replaces the current browser's participant session; other devices retain theirs. Logout revokes the presented session in storage and clears its cookie, leaving member cookies untouched. If logout cannot be confirmed, retain the signed-in UI with a retryable error.

Participant credentials must be rejected by member, admin, and anonymous-guest authentication; the opaque token fails JWT verification and rides in a cookie member guards never read. Look sessions up through `KoraSessionService.current` rather than relaxing existing member guards. The required participant guard arrives with the first participant-only endpoint, since none exists in this scope. A temporary signup continuation grants only completion access. The backend, not just the UI, enforces these boundaries.

Keep new participant entry points under the same environment availability as the project page: `KoraAvailableGuard` and the page's loader both answer 404 wherever `KORA_AVAILABLE` in `common/src/kora.ts` is false, currently production and any unrecognized environment. Launch flips that one entry (R9).

## Verification before implementation handoff

Use API integration tests with delivery/provider stubs and database assertions, plus browser interaction tests for the form. Cover:

- Both OTP channels through first signup and returning login, including a phone-only record with no email, an unavailable timezone, and rejection of missing/blank names or malformed contacts.
- Google and Apple with and without a supplied name; email-OTP/provider matching in both orders; relay/different-email separation; stable provider identity after email changes; concurrent signup/link attempts and conflicting identity ownership.
- Every OTP boundary in R5, the operational limits above, delivery errors, expired continuations, concurrent verification/resend, single-use replay, and absence of raw OTPs in application persistence/logs.
- Session renewal and expiration using a controlled clock; separate browsers; logout/replay; loss of a response after successful signup followed by a fresh login without duplicate creation.
- R2 member-message precedence; separation from member/waitlist writes and cookies; rejection of participant credentials on member/admin APIs; OAuth state mismatch and disallowed redirect origins; production availability restrictions.
- Loading, retry, code paste/autofill, resend countdown, contact correction, OAuth cancellation, name completion, reload restoration, and sign-out on desktop and phone-sized browsers.

## Pull requests

Deliver as five stacked PRs, each with the tests above that cover its scope. Partial merges are safe because every new entry point shares the project page's production restriction.

1. Delivery transport: `MailService.sendUnrecordedMail` and `MmsService.sendUnrecordedText` send without a member, stored body, or link tracking, and return a `DeliveryFailure` instead of faking a send. They share the provider call with `sendMail` and `sendMms`, whose behavior is unchanged. `processKeywordReplacements` moves to `notifs/notification-keywords.ts` to keep `mail.service.ts` under 500 lines. Commit this spec with it.
2. Backend participant core: the generic OTP module; participant, challenge, rate-event, continuation, and session storage with one migration; cookie sessions; email and SMS OTP with limits and purging. Both channels share the challenge machinery and differ only in delivery. Endpoints under `/kora`:
   - `GET me`: signed-in participant, pending code, and pending signup, for reload restoration.
   - `POST code`: send a code. `DELETE code`: change the contact.
   - `POST code/verify`: sign in, or open a signup awaiting a name.
   - `POST signup`: name and complete. `POST sign-out`.
3. Kora naming: rename the participant module, tables, cookies, routes, launch switch, and OTP purpose to their `Kora` names (R1), with a migration renaming the merged tables, constraints, indexes, and enum value in place.
4. Frontend OTP flow: the participant form, extracted contact parsing and country selector, R2 precedence, and sign-out.
5. Google and Apple OAuth: identity storage and migration, participant start/callback handling, email matching and linking, and the provider buttons.

The split gives the security-heavy OTP/session review and the OAuth review their own diffs, and lets the existing mail and SMS paths be checked unchanged before anything depends on the new boundary.

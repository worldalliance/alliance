# Main invite QR and session-only browser memory

Implementation design for [REQUIREMENTS.md](./REQUIREMENTS.md). The technical choices below are agent-authored.

## Entry and navigation

The mobile Invites page's main QR encodes `/?ref=<encoded personal referral code>` on the configured invite origin, built by a new `getInviteLandingUrl` beside the signup URL helper, which stays intact. QR eligibility, the unavailable-code state, copied invitation links, reusable short-link redirects, flyers, and other QR displays keep their behavior. A web QR generator is outside scope.

The destination is the ordinary homepage. "Accept invite" navigates to `/signup?ref=<encoded effective code>`. Account creation, invitation claiming, attribution, and group placement happen through signup; scanning and browsing perform none of those operations.

Share invitation state across the public-site navbar, generic closing join card, and footer Join link. The navbar shows "Accept invite" and its dismissal control on desktop and mobile web, including People, Guide, Progress, and other pages using the public-site chrome. A page that passes the navbar its own signup link (an action page) keeps it. The signup page's own navbar offers no invitation, since it is the destination. The generic join card uses the same action label; the footer keeps "Join." Project, campaign, partnership, and grantmaking links and forms keep their explicit destinations and copy.

Keep the homepage's explainer content. Inviter details appear in signup. Wait for authentication to settle before capturing a code; authenticated visitors see account navigation and leave session invitation state alone.

Only `/`, `/invite`, `/signup`, and `/onboarding` capture `ref`; action and campaign pages read their own `ref` for other purposes.

## Invitation session

Invitation memory lasts for the current browser tab's page session. Store its context in `sessionStorage` under `alliance:invite` as `{ explicit, saved }`: the latest URL code until it proves valid (or the code confirmed unavailable), and the last code that proved valid or could not be checked. A provider in the app root holds the same state in React, giving immediate updates and a fallback when storage is blocked; it reads storage after mount, since pages render on the server. With that fallback, a reload can recover only a code still present in the URL.

A fresh independent page session without `ref` starts empty. Follow the browser's native lifecycle: restoring a tab can restore its page session, and a tab opened with an opener can receive an independent initial copy. This feature adds no cross-tab synchronization. Opening a URL containing `ref` is an explicit invitation visit. See [MDN's sessionStorage lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

## Waitlist confirmation session

Waitlist confirmation lasts for the current browser session. Use an opaque `waitlist_session` cookie with HttpOnly, production Secure, and SameSite protections, issued without `Max-Age` or `Expires`. This keeps the limited confirmation credential inaccessible to JavaScript. Tabs in that browser session may share the confirmation, unlike the tab-local invitation context. A genuinely fresh browser session has neither an automatic confirmation nor its sharing link. Browsers may restore session cookies when restoring a session; follow that native lifecycle. See [MDN's session-cookie behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

The server maps the session token's hash to the waitlist entry and validates it on lookup. Keep bounded server-side token expiry and cleanup; a database row alone cannot restore a browser's confirmation. Ending browser memory does not delete the waitlist entry, revoke invitations, or invalidate an emailed sharing link. Without a session token, show the ordinary waitlist flow; submitting a known email or opening another person's public sharing link must not reveal their private confirmation state.

If the session cookie cannot be stored, a successful submission still shows its confirmation in the current page. A reload or fresh visit may lose that view; the emailed sharing link remains the recovery path. Cookie failure must not fail or repeat a successful waitlist submission.

## Storage purpose

Store only the context required for the current signup and waitlist-confirmation journeys. Persistent browser identifiers for either journey, localStorage copies, account-linked browser recovery, and a "remember for later" control are excluded. Add no consent popup or additional tracking use of this state. Session lifetime alone does not establish a consent exemption; necessity depends on the requested service and purpose. See [ICO's strictly necessary exception](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).

## Invitation selection and validation

Select the effective invitation in this order: the current URL's code, the explicit code carried in memory through this tab's navigation, then the code restored from this page session. General join actions always pass that code to signup. A bare signup URL retains its explicit-code behavior and does not infer an invitation from storage.

Use the signup page's resolver (`useInvite`: the referrer-profile and onetime-invite lookups) for personal codes, reusable invite links, and single-use invitations. `useInvite` now tells a failed lookup from a refusal, so an outage reports unknown validity instead of "names nothing"; signup shares this, so an outage there no longer reads as an invalid link. A campaign code resolves as valid like any other referrer. Preserve the exact reusable link code so its attribution and placement remain intact. Campaign and action referral behavior is outside this session-memory feature. Revalidate restored codes, check again when returning to the tab, and enforce validity at signup.

| State                                | Behavior                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| No invitation                        | Ordinary public navigation and waitlist actions.                                                                                                    |
| Valid explicit invitation            | Select it and replace the saved valid invitation after validation.                                                                                  |
| Valid restored invitation            | Show invitation actions within this page session.                                                                                                   |
| Unavailable explicit invitation      | Show "This invitation is no longer available" and waitlist actions. Keep a different valid saved code, but suppress it for this session.            |
| Saved invitation becomes unavailable | Clear that code and show the unavailable state.                                                                                                     |
| Storage fails                        | Carry the code in memory and continue passing it into signup.                                                                                       |
| Validation request fails             | Keep the code with unknown validity and permit the signup path to check it. An outage alone never clears storage or produces an unavailable notice. |
| Authenticated visitor                | Hide invitation controls and leave session state intact.                                                                                            |

Show "This invitation is no longer available" as a line under the navbar on every public page, with the dismissal control. Carry an unavailable explicit context through navigation and refresh so that visiting Guide cannot silently select another invitation. A valid explicit code can supersede it. While any selected code is being checked, the navbar's account cluster stays hidden as it does during authentication loading, so no actions for a different saved code flash. A validation result applies only if its code is still the selected one, which also handles out-of-order responses and results arriving after dismissal.

## Integration boundaries

Homepage, invite, and signup entry points capture codes into the same session mechanism. The waitlist page's invitation-resume action reads that session context too.

The server no longer stores invitation codes. `GET /waitlist/browser` keeps its response shape with `inviteCode` always `null` and accepts only `waitlist_session`. It expires incoming `remembered_invite` and `waitlist_browser` cookies without restoring or converting their values; `DELETE /waitlist/browser` clears them too. Remove the invite-memory endpoint (`POST /waitlist/browser/invite`), its DTO, and the `isInviteClaimable` helper only it used: older bundles call it fire-and-forget, so a 404 costs them nothing, and a missing endpoint cannot issue storage. Joining the waitlist issues only the session cookie, including when called by another client version.

Reuse the existing waitlist browser-token table for the session association, keeping its 30-day server expiry as the bound on a browser-restored session cookie; no database migration is required. Tokens not authorized by an accepted session cookie confer no browser restoration and are removed through expiry cleanup. Account authentication cookies and unrelated storage remain outside scope.

## Dismissal

Place a compact icon beside "Accept invite" with the accessible name and tooltip "Forget invitation." It clears this tab's invitation context, its sessionStorage key, and related cached data. Remove `ref` from the current URL with history replacement, preserving other parameters, so refreshing does not capture it again. An explicit invitation visit can set new session state.

Invitation dismissal requires no server operation. It leaves other storage keys, waitlist records, invitation records, and account sessions intact. The waitlist page's "Forget this browser" deletes its server-side session association, clears the waitlist session cookie, and clears this tab's invitation context. A server failure remains retryable and must not report successful forgetting. Either control updates all invitation actions in the tab; only the whole-browser control ends waitlist confirmation access.

Ignore in-flight validation or restoration results after dismissal. No dismissal control is shown while a code is being checked, so dismissal during validation reaches the provider only through the waitlist page's control or a revalidation on returning to the tab. If removal from sessionStorage fails, suppress the code in memory and show a small retryable error under the navbar; do not promise it cannot return on refresh. Storage failures during browsing remain nonblocking.

## Acceptance checks

The feature is complete when these checks pass:

1. Only the main mobile QR's destination changes. Decode it and verify the homepage receives the member's personal code.
2. Scan, explore Guide and People, reload, and enter signup in one page session. Navbar, generic join card, and footer preserve the same code on desktop and mobile web.
3. Verify all supported invitation categories, including reusable-link attribution and group placement. Browsing consumes no invitation; signup enforces single-use claiming.
4. Test explicit-code precedence, unavailable-code suppression through navigation and reload, and out-of-order validation responses.
5. Test deleted, used, and refused invitations separately from network failures. Only confirmed unavailability clears a saved code.
6. A fresh independent page session without a code offers the waitlist path. Invite-memory calls create no persistent cookie. Incoming `remembered_invite` and `waitlist_browser` values cannot restore either journey and are cleared; account authentication remains intact.
7. With sessionStorage blocked, navigation still carries the invitation. Reloading without storage or a URL code starts without an invitation.
8. Dismiss on a URL containing `ref`, during validation, and with a simulated storage-removal failure. Verify refresh behavior, retry, and the waitlist's whole-browser control.
9. Authentication loading and authenticated scans cannot overwrite invitation state. Signed-in navigation stays usable.
10. Grantmaking/project actions and signup's account/agreement flow keep their behavior. There is no cookie popup or long-term remembering option.
11. A new waitlist entry restores its confirmation during the browser session using a cookie with no persistent expiry attributes. A fresh browser session does not restore it, while the waitlist entry and emailed sharing link remain usable. Server expiry or forgetting invalidates the session token.
12. Blocking waitlist cookies leaves submission and its immediate confirmation usable. Test reload without a token, known-email submissions, and public sharing links to ensure they cannot disclose another entrant's confirmation. No waitlist API client can create persistent browser memory.

Use focused unit and server integration tests for selection, storage, validation, session-cookie issuance, cookie clearing, and dismissal. Verify scan-to-signup and waitlist-session restoration in a mobile browser and the QR in the app, then run the affected packages' typechecks and the repository duplication and changed-logic coverage checks.

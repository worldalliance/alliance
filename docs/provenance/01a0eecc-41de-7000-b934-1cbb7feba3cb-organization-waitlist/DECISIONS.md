# Organization waitlist specification

This file contains agent-authored design choices and acceptance criteria. REQUIREMENTS.md distinguishes direct user requirements from approvals of agent proposals. The interview is complete; this task produces documentation only.

## Delivery boundary

Implement the waitlist backend, admin workflow, and functional integration with `/projects/democratic-grantmaking-26`. Retain the current page's layout while connecting its data, adding conditional reason collection, and supplying a basic confirmation. Final public copy and visual design belong to the designer.

All email operations in this release are immediate. Saved cohorts and templates support manual followups; no scheduler, event-relative rules, action-date integration, or automatic group-lead outreach is included. No special account onboarding, general email-based account matching, or historical join-request import is included.

The page works responsively in mobile browsers. Normal registration and invite claiming must remain compatible with existing web/mobile paths. This project does not introduce a native waitlist dashboard.

## Pull request stack

Deliver as stacked pull requests. PR 0 is #323 on `charlie/project-page`; later PRs use branches `charles/waitlist-<n>-<slug>`. PR 0 targets `main`; each later PR targets the previous PR's branch. Order follows dependencies:

0. Done, #323. The page redesign with placeholder data. PR 4 connects it.
1. Done, #328. This specification.
2. Done, #329. Atomic invite claiming, a fix independent of the waitlist: account creation claims its invite in the same transaction, and pending or rejected invite requests cannot be claimed (ALL-1281).
3. Done, #330. Data model: campaign kind, the organization's unique group, waitlist entries, organization links, organization-owned invites. Backend and migrations only, plus an independent fix: a one-time invite with no inviting user can be deleted, approved, or rejected without a 500.
4. Done, #331. Public entry: email submission API, personal sharing links, the reason rule, page wiring, member/waitlist counts and social proof, `/join` removal and redirect. Sends no email.
5. Done, #333. Public email: confirmation and recovery mail, recipient and IP limits, the global volume cap. Public sending stays disabled until the Mailgun threshold is chosen.
6. Done, #334. Remembered browser state and “Forget this browser.”
7. Admin: organizations and their links, the waitlist list, filters, tags, cohorts, manual mobilize/undo.
8. Admin email: composer, templates, durable batches, idempotent sends, unsubscribe, send-and-mobilize.
9. Metrics.

PRs 5 and 8 each send real email, so each gets its own focused review. The onboarding localStorage password fix stays outside the stack.

At the user's request, no PR merges until the whole stack is approved, and the stack lands together:

- PR 0 stays a draft until then, and each PR body lists the stack.
- Land top-down: squash PR 9 into PR 8's branch, then 8 into 7, and so on, finishing with PR 0 into `main`. `main` receives one commit and `deploy.yaml`, which deploys every push to `main`, runs once. Landing bottom-up would deploy each partial state.
- `ci.yaml` runs only on PRs targeting `main` or `production`, so PRs 1–9 get no CI until they fold into PR 0. Run typecheck, tests, dupcheck, and covercheck locally for each PR.
- After amending a lower PR or rebasing onto `main`, run `git rebase --update-refs` from the top branch to move every branch in the stack, then `git push --force-with-lease` each moved branch.

## Existing implementation and gaps

These are observations of this branch, not evidence of user intent:

- The project form currently prevents submission. The inviter, counts, featured people, and member list are fixtures. Body sections contain lorem ipsum. There is no waitlist persistence.
- The timeline and required commitment checkbox exist. The visible heading differs from the supplied project title; the progress bar follows the opening section, and the opening section is not explicitly constrained to a viewport. Advisor identities, pilot text, and assessment criteria remain designer deliverables.
- `Campaign` stores a name, picture, and referral code, owns share links, and supplies account attribution and invite-graph nodes. It has no notification scheduling semantics.
- Existing one-time invites store a destination community, claimant, and use timestamp. Their creation expects a user inviter. Organization ownership and links back to waitlist recipients require extensions.
- Normal registration already supports one-time referrals. Account creation currently marks an invite used before creating the user; this path needs atomic claiming for reliable new bulk-issued invitations.
- Group placement occurs through existing signup/contract processing. Campaign-owned share referral resolution currently drops the share-link assignment; using organization-owned one-time invites requires carrying the organization and existing destination through the supported referral path.
- Existing mail infrastructure records pending/sent/failed messages and rendered content. Existing templates and invite-funnel metrics are useful foundations, not a ready-made waitlist system.
- Existing `/join` submits a reason-bearing request to staff through Slack. Replace its public entry path, without converting historical requests into waitlist entries. Remove any form/API code orphaned by the replacement after checking callers; preserve event history.

## Records and attribution

Use the current campaign identity as the organization record. Add a closed campaign kind distinguishing organization from ordinary campaign, plus a nullable unique community relationship. Existing campaigns default to ordinary campaign; staff explicitly designate organization records. Preserve their existing codes, links, and attributed accounts. Organization editing supplies a display name, logo, and group selector; fall back to the group's photo when no logo exists.

Use one waitlist entry per trimmed, case-normalized email, without provider-specific dot/plus rewriting. Store name, email, optional reason, commitment timestamp, creation time, nullable organization, original incoming waitlist link, nullable referring waitlist entry, personal sharing code, mobilized timestamp, unsubscribe state, and manual tag associations. The reason is required and nonblank when the resolved organization is absent. Apply bounded text validation using established form conventions. Determine organization/referrer server-side from the link.

Organization waitlist links are reusable acquisition links, distinct from normal account invites. Store their organization, human-readable channel label, creation timestamp, and optional publication timestamp. Link creation selects an organization, not a future waitlist member's group. Multiple labels and links may belong to the same organization.

Each new waitlist entry gets a stable reusable personal sharing link, including entries with no organization. Its descendants inherit organization attribution and retain their direct referring entry. Keep the original organization/channel source as well as the immediate personal referrer so staff can count both distribution and referral chains. Sharing continues after mobilization or invite claim.

Duplicates leave name, reason, attribution, commitment, tags, and statuses unchanged. A duplicate sees the same success message without a personal link (see the PR 4 choices below); knowing an email alone does not grant access to its details or signup invite. An explicit recovery action sends the personal sharing link to the stored email.

Existing Alliance accounts may enter this separate waitlist. Do not infer identity or conversion from an unverified submitted email. The admin's account-related filter is explicitly invite-derived, not an assertion that every unclaimed entry lacks an account.

Keep waitlist, organization, and invite history persistent. Default operations archive/disable acquisition links rather than deleting attribution. Invalid or disabled incoming links show an error with an explicit option to continue without an organization; do not silently assign a different source.

PR 3 schema choices:

- Organization waitlist links get their own `waitlist_link` table rather than reusing `share_url`, whose invite links lead to account signup.
- The database enforces the entry rules it can: email is `citext`, like `user.email`, and must be stored trimmed; an entry without an organization needs a nonblank reason; an invite names at most one of an inviting user and an organization.
- An entry's `sourceLinkId` names the organization link its referral chain started from. PR 4's entry service copies it, and the organization, from the referrer when an entry joins through a personal link; the database does not check this (ALL-1284).
- The foreign keys this PR adds into campaigns, links, and entries do not cascade, so deleting a record that waitlist attribution depends on fails. The older `share_url` and `user.referredByCampaignId` keys still cascade and set null. An organization's `communityId` sets null when its group is deleted, leaving the organization and its attribution in place.
- Nothing in the schema requires a waitlist entry's, link's, or invite's campaign to be an organization; the writers in PRs 4, 7, and 8 check `kind` (ALL-1283).
- An organization-issued invite records `organizationId` and `waitlistEntryId`. Its claimant keeps the `onetime_invite` referral source and reaches the organization through the invite, since `user.referredByCampaignId` requires the `campaign` source.
- Tags and staff action records arrive with PR 7, their first reader. New columns carry no Swagger annotations; later PRs expose them through DTOs.

## Public entry, confirmation, and returning visits

Show validation errors before submission, prevent duplicate clicks while submitting, and preserve input on failures. A successful database insert defines entry success even when confirmation email fails; display the personal link immediately and offer the protected recovery path. Do not recreate an entry or automatically resend email on a repeated submission.

Confirmation shows that the person is on the waitlist, that staff will email when they can join, and a copyable personal sharing link. A remembered mobilized entry instead says an invitation was sent; it does not disclose that private invite unless this browser previously opened it. Designers own final language.

Referral banners use organization branding for direct organization links and the inviter's display name for personal links. Personal links still carry the organization's attribution. No referral means no invented inviter. Organization social proof uses cumulative distinct entries attributed to that organization, with the three-entry wording threshold. Main progress uses the existing active-member definition and currently non-mobilized waitlist entries, against the existing project goal. Keep both counts separately visible and cap the visual fill at the goal. Unsubscribing does not itself mobilize or erase an entry.

Remember waitlist access using an opaque, random, limited-purpose identifier in a Secure, HttpOnly, SameSite cookie, valid for 30 days. Store its association server-side; its authority is limited to the confirmation/share view. Never store passwords, provider credentials, or account authentication tokens for this feature in localStorage. Cookie refusal simply loses browser restoration; it does not block entry.

Remember an explicitly opened normal signup invite separately, for 30 days. Explicit URL codes take precedence, including showing an error for an invalid explicit code rather than silently reverting to an older invite. Revalidate remembered codes before offering signup, and discard used/revoked codes. Merely receiving an email cannot set this browser state. Neither the public personal sharing code nor an unverified duplicate submission can reveal an issued signup invite.

Provide “Forget this browser” to clear both waitlist and remembered-invite state without deleting the entry, revoking invitations, or logging out an unrelated Alliance account. Email supplies cross-device recovery of the public sharing link; no separate private waitlist login-link system is necessary for this release.

Point all on-site join CTAs and content links at the project page. Keep `/join` only as a redirect, preserving referral query parameters that the project page understands. Leave `/signup` as the existing account-creation route.

The existing onboarding draft writes a password to localStorage. Removal is a separately identified fix, not part of this specification's waitlist persistence work.

PR 4 public entry choices:

- The page reads an organization link's code from `?link=` and a personal code from `?ref=`. Separate parameters keep codes from the two tables from colliding. `/join` redirects to the page and keeps only these two parameters. A null link or referrer code is refused rather than treated as absent.
- `POST /waitlist/entries` returns the new entry's personal code, or `null` for an email already on the waitlist. Both see the same success message, but only a new entry shows a link. The spec originally called for a generic confirmation that hid whether an email was already present. Here a submitter can tell, though nothing about the existing entry: showing a new entry's link right away, without email verification, requires it. PR 6's browser state and PR 5's recovery email restore the link for returning visitors.
- The email is stored trimmed, with its case as typed; `citext` makes uniqueness case-insensitive. Personal codes are 8 random bytes in base64url.
- A repeated or concurrent submission for one email relies on the unique email index. The insert uses `ON CONFLICT DO NOTHING` rather than catching a unique violation, because a failed query is logged with its parameters, here the entrant's details. When nothing was inserted and the email exists, the submission is a duplicate; otherwise the personal code collided and the request fails.
- Entry creation allows 30 requests a minute and 200 an hour per IP, as loose as OAuth sign-in, because an organization's audience often joins from one office or event network. PR 5 adds the per-recipient and global email limits.
- `GET /waitlist/referral` returns the organization's name, its logo or else its group's photo, and its count of all attributed entries, plus, for a personal link, the inviter's name. It never returns an email. A personal link shows the inviter's name even when the inviter has an organization; that entrant still inherits the organization and so skips the reason.
- An unknown or archived link, a campaign that is not an organization, or a failed lookup disables submission and offers "Continue without this link", which removes both parameters. A failed lookup can also be retried. A link archived between loading and submitting shows the same state.
- The progress bar reads members from the existing `/user/nmembers` and the waitlist from `GET /waitlist/count`, and shows text while loading or when a count fails. Featured people, the member list, and body copy stay placeholders for the designer.
- The login screen's "Request an invite" mail link was an on-site join CTA, so it now links to the page. Removing the join request endpoint keeps `EventType.JoinRequest`, so past join request events stay readable. A new entry posts nothing to Slack. Join requests were the only messages routed to the existing Slack firehose channel, a routing an earlier task added at the user's request for join request spam. That routing and deploy's `SLACK_FIREHOSE_WEBHOOK_URL` export go with the endpoint, and each GitHub environment's secret can be deleted once the stack deploys there: staging's when it reaches `main`, production's when it reaches `production`.

PR 6 browser state choices:

- Only a new entry remembers its browser. A duplicate submission or a visit through a personal link never does, since an unverified email or a public code would otherwise hand a stranger that entry's link and status. The confirmation email is queued before the browser is remembered, so a failure to remember never costs the entrant their emailed link.
- The `waitlist_browser` cookie holds 32 random bytes. The `waitlist_browser` table stores their sha256 with the entry and an expiry 30 days out, matching the cookie's `Max-Age`. A daily cron deletes expired rows. The `waitlist_browser` and `remembered_invite` cookies are both HttpOnly and `SameSite=Strict`, and Secure in production, like the auth cookies (local development runs over http).
- `GET /waitlist/browser` returns the remembered entry's personal code and whether it is mobilized, and nothing else about it. A mobilized entry's confirmation says an invitation was emailed, and still shows the personal link.
- A remembered browser sees its confirmation instead of the form, whatever referral parameters the URL carries. The form stays disabled until the browser state answers, so a returning entrant's typing can't vanish into their confirmation; if the lookup fails, the form works as before.
- The `remembered_invite` cookie holds the invite code itself. The browser already had it in a URL, and HttpOnly keeps it from scripts. The invite page and the onboarding page (`/onboarding`, `/signup`, `/login`) post any `?ref=` code to `POST /waitlist/browser/invite`. It answers 204 either way, and remembers only a one-time invite that signup could still claim, by `UserService`'s claim rule. Reusable referral codes are public and never spent, so they are not remembered. A claimable newly opened invite replaces the remembered one; an unusable one leaves it.
- Every `GET /waitlist/browser` rechecks the remembered invite and clears the cookie once the invite is deleted, claimed, or refused.
- Only the waitlist page offers a remembered invite, as "Continue signing up" to `/signup?ref=`. `/signup` never falls back to a remembered code, so an explicit code always wins, and an invalid one shows its own error.
- "Forget this browser" (`DELETE /waitlist/browser`) deletes the browser's row and clears both cookies. It leaves the entry, invites, and auth cookies alone. It shows whenever either is remembered, including right after joining.
- The mobile app gets nothing: the waitlist is a web page, and this project adds no native waitlist.

## Email abuse and recovery

The user approved these agent recommendations and explicitly requested recording them in DECISIONS only. The user later dropped bot protection, so the recipient, IP, and global limits carry the protection. The prior attack used different IPs/devices; per-IP limits alone do not address that pattern.

Send one automatic confirmation email containing the personal sharing link after first entry. Add an explicit “Email me my link” recovery action. Duplicate submissions do not trigger mail. Both public send paths use existing-style IP throttles and a shared per-normalized-recipient limit; changing devices/IPs must not reset the recipient allowance. Start with no more than one public-triggered email per recipient per 24 hours. Staff-initiated sends are separate.

Require the email-send allowance to be claimed atomically across concurrent requests, independently of whether a waitlist row already exists. Use bounded global send-volume protection and visible operational failure reporting to limit distributed attacks across many email addresses. Choose its deployment threshold against the actual Mailgun allowance before enabling public sending; no account pricing or quota was inspected in this task.

Recovery returns the same generic response for absent, suppressed, and existing entries. Reuse stored content rather than reflecting arbitrary newly submitted names or text into recovery mail. Unsubscribed recipients stay suppressed on public recovery; repeated form submissions cannot resubscribe them. Public email-send failures do not silently enable an unprotected send path.

PR 5 public email choices:

- Public email is on only when `WAITLIST_PUBLIC_MAIL_DAILY_CAP` is set; deploy exports it, empty until each environment sets it. `GET /waitlist/mail-config` tells the page, so the server alone decides whether to offer recovery. A malformed cap fails boot.
- A new entry's confirmation goes out in the background, so a slow or failing mail server never holds up the page showing its link. A failed send only logs; the entry stays recorded.
- Recovery is `POST /waitlist/link-requests`, offered on the duplicate confirmation, where the page already has the address. It answers 204 alike for present, absent, and unsubscribed addresses and for those over their own or the day's allowance, and mails in the background so its timing doesn't tell them apart. With public email off it answers 503, whatever the address. Per IP it takes 5 a minute and 20 an hour, as account registration does (`SIGNUP_THROTTLE`), and answers 429 past that.
- `waitlist_mail_allowance` holds one row per address (`citext`) with its last claim. One transaction-scoped advisory lock serializes every claim, so the per-address rule (one per rolling 24 hours) and the global cap (per UTC day) are checked and claimed atomically. A day's claims are the rows claimed that day, since an address can claim at most once in it. A claim is not refunded when the send then fails, so failures cannot be used to retry past the limit.
- The claim that fills the day's cap posts a `waitlist_mail_cap_reached` event to Slack, once per day. Later refusals only log.
- The emails carry only the personal link, never the stored name, so a stranger's submitted text never reaches someone else's inbox. Unsubscribe arrives with PR 8's waitlist unsubscribe; public mail already skips unsubscribed entries. Leave the cap unset in every environment until then (ALL-1291), since anyone can request a stranger's link daily.

This reduces amplification but does not prove genuine intent or defeat all distributed abuse. Mailgun charges can apply above the account's allowance. References: [Mailgun overages](https://help.mailgun.com/hc/en-us/articles/6745531451547-What-happens-if-I-send-more-emails-than-my-monthly-plan-provides), [OWASP browser storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage), [OWASP recovery protections](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Signup invites and independent statuses

Extend existing single-use invites to support organization ownership, while retaining existing user-owned behavior. A waitlist-issued invite records its recipient entry and optional destination community; staff can also issue a general invite with no organization or destination. An account can claim it with any email, irrespective of waitlist membership.

Allocate a recipient's invite when an email needs `#{signupLink}`. Reuse its current unused invite in retries and later messages. Previewing a draft does not consume an invite. Missing/full/unavailable groups produce an explicit confirmation warning; proceeding leaves placement to staff where the normal destination cannot be honored. Group existence and capacity must be rechecked at actual placement, not just at send time.

Copy the destination onto the invite when issued. Changing an organization's group does not silently retarget already emailed invitations. Use the existing admin invite-edit capability, or an explicit replacement, when staff intend to change an outstanding destination.

Consume an invite exactly once in the same database transaction as successful account creation and its claimant relationship. Failed registration leaves it usable. `UserService.create` claims the invite a new user references: it marks the invite used, which locks its row, unless the invite is deleted or is a pending or rejected invite request, then refuses the claim if an account already references it. A referencing account, not `status`, decides whether an invite is spent, as before this change, so invites that the old path marked used on a failed signup stay claimable. Preserve existing email/password and OAuth account signup screens, contract flow, and ordinary member invitations. Carry organization attribution for reporting without assigning an artificial staff member as the referrer.

Expose mobilization and invite claim as independent dimensions:

| Dimension                              | Meaning                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| Waiting / mobilized                    | Staff acceptance status, toggled manually or after successful send. |
| No invite / unused / claimed / revoked | Recorded lifecycle of issued signup invitations.                    |
| Subscribed / unsubscribed              | Eligibility for waitlist mail; independent of acceptance.           |

Keep invite history when replacing/revoking a code. “Invite claimed” means at least one associated invite has a claimant, even if staff undo mobilization. Display the claimant through existing admin account views, without claiming it is necessarily the named waitlist recipient. Signup through another link remains untracked here.

Undoing mobilization never revokes a code. Revoking an unused code never changes acceptance or an existing account. Replacing an unused invite revokes the old code and creates a new one after confirmation. Issuing another invite after a claim requires explicit confirmation; ordinary followups default to excluding claimed entries.

## Admin waitlist and cohorts

Use existing admin authorization. Keep operational access in admin; group-lead access to waitlist contact data is outside this release.

The list shows name/email, reason where present, organization, original channel/link, referrer, joined time, tags, mobilized status, and invite state. Provide searchable name/email, ascending/descending joined date and organization sorting, and filters for these attribution/status fields and date range. Include reason-present, subscription state, and invite-claimed filters.

Save a named cohort as the current filter definition, with results recomputed when opened. Combine different filters with AND and multiple selected values within a filter with OR; tags match any selected tag. Tags are separately named lists with explicit bulk add/remove membership. Saving a cohort does not create a tag or start an email job.

Selection supports checked rows and every matching result across pagination. Freeze recipient IDs for the confirmed send; changes to filters or new entries do not expand an approved batch. Recheck suppression and current statuses before sending, and report resulting skips.

Support manual mark/unmark mobilized, explicit invite revoke/replace, and tag changes. Confirmation warnings cover already-claimed invites, repeat sends, missing destination groups, and unusual status reversals. Record staff actions and timestamps sufficiently to distinguish manual acceptance, reversals, and successful emailed mobilization. Avoid an unrestricted override of email suppression; staff can communicate externally.

## Composer, templates, and sending

The composer has subject and formatted body, selection summary, template selection, and per-recipient preview. Reuse the application's established safe formatting/rendering conventions. Every real send, including a test send, requires clear recipient confirmation.

Implement `#{name}`, `#{organizationName}`, `#{signupLink}`, and `#{personalShareLink}` using the existing interpolation convention. Reject unknown placeholders and unresolved required values before sending; do not send raw tokens. For selections with no organization, flag use of `#{organizationName}` so staff can change the text or selection. `#{signupLink}` is a normal signup URL, not a waitlist referral URL.

“Send email” leaves acceptance unchanged. “Send email and mark as mobilized” marks each waiting recipient after provider acceptance. Mixed selections may include mobilized recipients, whose acceptance timestamp remains unchanged. Acceptance-changing messages require a signup-link placeholder or an explicit warning that staff are accepting people without supplying an invitation in that message.

Show final eligible recipient count, suppressed/skipped count, subject, rendered sample, and whether statuses will change. Confirm actual sending in a modal. Missing group warnings are advisory, as requested. After confirmation, process the fixed batch durably so leaving the admin page does not discard it.

Persist each batch and recipient result with rendered subject/body, invite reference, initiating admin, and provider-accepted time or failure. Provider acceptance defines “successfully sent”; it does not promise delivery. A later bounce does not automatically reverse mobilization. Failure leaves acceptance unchanged and appears in admin.

Make repeat submission of the same send request idempotent. Retry only recipients not known to have been accepted. When a provider timeout leaves the outcome uncertain, surface that uncertainty rather than blindly generating duplicate mail. Staff can explicitly resend after confirmation. Existing successful recipients keep their original recorded send outcome.

Message history offers “Use again” to create an editable draft. “Save as template” explicitly creates or updates a named reusable subject/body. Editing a template cannot rewrite historical messages. Add unsubscribe to waitlist emails and enforce its suppression on bulk sending; retain entries and attribution for staff and metrics.

## Metrics

Store timestamps and relationships first; avoid a general analytics framework. Initial admin summaries offer:

- Distinct waitlist entries and signup counts over time, grouped by organization and acquisition link/channel, with each link's optional publication date visible.
- Waiting, mobilized, and invite-claimed counts for filtered cohorts.
- Successful mobilization recipients, associated invite claims, and elapsed time between first successful mobilization send and claim. Manual acceptance without a recorded email has no fabricated send-to-claim duration.
- Among claimed invitations, counts reaching contract signing and first completed action, including onboarding actions. Aggregate by organization and the invite's destination group, retaining an unassigned bucket.

Use distinct recipient entries for recipient conversion rates, and show individual invite claims separately if staff issue replacements/additional invites. Keep numerator/denominator populations explicit and based on the same selected cohort. A forwarded invite measures use of that invitation, not verified conversion of the original recipient. Do not implement click/open tracking or unrelated-signup matching for this release.

## Acceptance checks

Implementation is complete when these behaviors pass focused automated checks and the public/admin flows are verified using synthetic data:

1. Organization, personal, and direct entry resolve the expected attribution. Referral chains retain organization/channel and immediate referrer; direct/unaffiliated entries require a reason.
2. Duplicate and concurrent entry submissions produce one record and one personal code, retain initial attribution/status, and cannot grant access by merely submitting a known email. Commitment and invalid fields are rejected server-side.
3. A public sharing link permits referrals but reveals no email, private browser access, or mobilization invite. Public email requests obey recipient and IP limits, suppression, and atomic send allowances even under concurrent submissions.
4. Confirmation and recovery emails preserve access to the public share link. Mail failure does not lose a recorded entry. Returning browsers restore only authorized state; forgetting/expiry clears it. Explicit invites override remembered codes; used/revoked codes cannot start signup.
5. Multiple organization links attribute independently. An organization can lack a group, but two organizations cannot claim the same group. Issued invites retain their destination unless explicitly changed.
6. Admin cohorts recompute from saved filters, tags change only manually, selection spans pagination correctly, and confirmed email batches do not acquire new recipients. Suppressed entries are skipped with visible counts.
7. Email-only, send-and-mobilize, manual mobilize, undo, revoke, replacement, and claimed-invite warnings work independently. Partial failure marks only successful recipients; retries cannot resend known successes accidentally. Historical mail/template content remains stable.
8. Password and OAuth registration use the existing signup flow. Concurrent claims allow one account; failed creation leaves the invite unused. The eventual claimant/organization/group and timestamps support the funnel, including forwarding and unavailable-group fallback.
9. Member/waitlist counts and organization social proof obey their different populations and threshold. All former on-site `/join` links lead to the project page, and `/join` redirects. Ordinary account invites keep working.
10. Metric fixtures cover manual acceptance without email, duplicate entries, forwarded claims, replacement invites, contract signing, and onboarding-action completion. Untracked alternate-invite signup is not falsely reported as a conversion.

Run package typechecks, meaningful tests, duplication checks, and changed-logic coverage review during implementation. This documentation-only task requires formatting, duplication review, and a scan for secrets/personal information; it does not exercise application behavior. Final page copy, advisor identities, and exact viewport design remain designer handoff items, not claims of completed implementation.

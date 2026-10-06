# Implementation design

The accepted product choices and exact signup copy are in [REQUIREMENTS.md](REQUIREMENTS.md). The details below are agent-authored implementation decisions and acceptance criteria, not additional user-origin requirements.

## Contact input

Keep the combined input's raw text while the visitor edits it. The existing phone-only input and hook remove nonnumeric characters; applying them directly would corrupt email addresses, including ones beginning with digits. Reuse their country data and parsing/display utilities without applying destructive phone formatting to the combined text.

Treat a value containing `@` as email input, validated with zod's email rule; any other text goes to `toE164`, so extensions keep parsing. Show the country selector only for nonempty number-like text composed of digits and phone punctuation (`looksLikePhoneNumber` in `common/src/phone.ts`); hide it for empty or email text. Showing or hiding the selector preserves the input value, caret, and focus. A previously chosen country persists while the visitor edits the contact. Validate on blur or submit, and retain the draft after a failed request.

An explicit international prefix determines the number's country when it can be resolved. Otherwise parse under the selected country. Reinterpret an unfinished national number when the country selection changes, using the shared utilities rather than guessing from browser language or location. The input keeps only raw text; the country comes from `usePhoneFieldCountry`, and the number is parsed at blur and submit, so a country change needs no rewrite of the value. The country selector is extracted from `PhoneNumberInput` into `sharedweb/ui/PhoneCountrySelect.tsx` and shared by both inputs; its calling code and caret now take their color from the container through opacity so it reads on the dark waitlist form.

Use `toE164` for fallible validation and canonical phone storage, `formatPhoneNumberForDisplay` for admin presentation, and `phoneSearchDigits` for searching equivalent punctuation. Preserve the parser's existing acceptance rules, including extension removal. The result establishes neither a working handset nor verified ownership; the form and admin must not label it verified.

Keep the text input usable for email on mobile browsers even while the country selector is visible. Numeric email usernames must remain enterable without switching controls.

## API and persistence

Send one typed contact property: `email` or `phoneNumber`. Preserve existing email-only requests; the combined frontend input does not require a combined database column or a stored preference discriminator. Derive the contact method from the populated column.

At the server boundary, reject both contacts, neither contact, blank contact values, invalid email, and noncanonical/invalid phone numbers. Each property validates only when present (the existing `IsE164` validator for phone); the exactly-one rule lives in `WaitlistService.create` as `WaitlistEntryError.OneContact`, beside the existing link-code rule, and yields a typed contact union. Continue trimming email and using its current case-insensitive identity rules. Represent absent entity columns as `null`; public signup may omit the unused request property.

Make email nullable, add nullable phone storage, enforce the exclusive choice in the database (`CHK_waitlist_entry_one_contact`), and give canonical phone values a unique index. A second check (`CHK_waitlist_entry_phone_e164`) keeps stored numbers in E.164 form, so phone search can match digits with a plain `LIKE`. Keep the existing email uniqueness semantics. The migration preserves entry IDs, referral relationships, timestamps, browser associations, invitation relationships, and delivery history; it does not synthesize contacts for old rows. A rollback that would require deleting phone entries must fail rather than discard them.

Duplicate submissions are insert-or-ignore operations with the same response shape as the current flow: an existing contact produces no share code and no new browser association. Preserve its name, reason, commitment time, subscription/spam state, attribution, and mobilization status. Enforce uniqueness under concurrent submissions. A same-name submission through a different contact remains a distinct entry.

Phone submission never calls a mail or SMS delivery service. Existing email confirmation and link-recovery behavior retains its current configuration and rate limits. The email recovery endpoint continues to require an email address.

## Confirmation and recovery

Use the approved confirmation copy for both contact methods. Display a referral URL after successful creation or restoration through the existing browser cookie. Use the current remembering and forgetting behavior; a contact alone cannot restore an entry or reveal a later signup invitation.

For a duplicate phone submission without browser memory, render the generic waiting confirmation with no referral link or email-recovery control. The site's existing contact link provides access to staff assistance; this version adds no public phone lookup or automated recovery flow.

For a remembered mobilized entry, retain the “You’re invited to join” heading and use “Use your invitation to join the Alliance.” as the body. This is agent-authored copy for a state outside the approved waiting-copy table; it avoids asserting that an email was sent when staff used another channel. A separately remembered signup invitation keeps its existing precedence and claimability checks.

Staff assistance means staff locate the entry in admin and send its referral link to the stored contact. The new admin copy control exposes the public referral URL, not the private unsubscribe token or an account session.

## Admin contacts and email audiences

Display the populated contact under the entry's name. Search phone digits independent of separators while retaining name/email search; digit matching applies only when the search text looks like a phone number, so a name containing a digit does not match every number. Add a single optional `contactMethod` enum filter with Email and Phone options; an omitted filter means both. Apply it consistently to pagination, select-all, metrics, and saved cohorts. Existing saved filters remain valid. Rename the existing subscription filter's “Email” label to “Subscription” so it also describes phone entries.

Keep the distinction between a referral URL, which recruits another waitlist entrant, and a signup invitation, which permits account creation. Give their controls distinct accessible labels. Each opens a dialog that explains the link and shows it in a selectable field beside a copy button, so a clipboard failure leaves the URL available.

Add a `NoEmail` audience exclusion for entries without email. Check it before the existing exclusions so every selected phone entry appears in the phone-skipped count; retain the existing priority of exclusions for email entries. Apply the rule during preview, batch creation, and send-time validation: the server refuses a batch in which no selected entry has an email, and a mixed batch records its phone entries as skipped with `no_email` when the sender reaches them. A general refusal of all-skipped batches is not added, since an existing test sends to an all-unsubscribed selection. Including claimed invite recipients cannot override the missing-email exclusion.

Keep audience counts mutually exclusive and explain the exclusion as “Phone contact — no email address.” An all-phone selection has zero email recipients and no email send action. Recipient/sample DTOs and historical batch displays must tolerate nullable entry email without inventing a recipient address. The preview sample, and so the staff test message, still comes from email recipients; an all-phone selection has neither.

## Manual invitations

Expose individual invitation creation/copying under the existing admin authorization. Extract the existing invitation creation/reuse logic for use by both admin and email delivery, preserving organization placement and `waitlistEntryId` attribution. A normal signup claim through the link must continue to populate the existing account and contract history views even if the account's email differs from the waitlist contact.

Reuse an entry's current claimable invitation. If none is claimable, issue one through the same rules used by waitlist email; both callers use `WaitlistInviteService.inviteFor`, and email previews share its full-group lookup. The invitation dialog shows the entry's claimed-invite, subscription, and spam state before staff ask for the link; the group-placement warning arrives with the link, since it needs the server's capacity check. Staff can proceed in every case. Show spam and subscription status alongside the action; existing staff discretion for manual outreach remains separate from automatic email exclusion.

Serialize creation/reuse for a given entry across both callers so simultaneous requests cannot issue competing invitations; `inviteFor` takes a `FOR NO KEY UPDATE` lock on the entry row first. Preserve revocation checks and emit creation notifications only after a successful commit. A failed request reports failure; a clipboard failure leaves the committed invitation available for manual copying and retry.

Creating, retrieving, or copying an invitation sends no message and leaves mobilization unchanged. Staff record completed outreach through the existing manual action. A repeated copy reuses the same claimable link, and undoing mobilization retains its existing independence from revocation.

## Phone opt-outs

Use the entry's existing subscription timestamp for an individual admin “Mark unsubscribed” action on phone entries. The endpoint takes entry ids like the other status changes; the admin offers it per row for subscribed phone entries, behind a confirmation, since no resubscribe control exists. Show the status immediately and make repeat requests idempotent. Record the staff action using the existing entry-action history pattern. This operation changes waitlist contact status without altering referral attribution, account notification settings, or mobilization.

Manual outreach takes place outside the app, so staff are responsible for recording requests to stop. This version adds no SMS sender, inbound keyword integration, or resubscribe control; it does not imply the existing member-only Twilio opt-out handler covers waitlist entries. Subscriber filtering lets staff exclude these contacts from manual outreach lists.

## Acceptance criteria

Implementation is complete when the following behavior is covered by appropriate tests and the modified UI has been checked in a browser:

1. Email, a national US number, a national number under another selected country, and an explicit international number each create an entry with the expected stored contact. Invalid, blank, both-contact, and neither-contact API inputs fail without inserts or delivery attempts.
2. Switching between number-like input and an email with a numeric prefix preserves all typed characters. Country changes and international pastes produce the correct stored number without requiring a blur before submit. The country selector remains usable on mobile browsers and with a keyboard.
3. Equivalent number spellings, case-varied email, and concurrent duplicate submissions produce one entry per contact and retain its prior state. Separate contact methods remain separate entries.
4. New phone signup exposes a referral link and restores it through browser memory, with zero outbound messages. Duplicate signup from a different browser exposes neither the original referral link nor a signup invitation. Email recovery and “Forget this browser” retain their existing behavior.
5. A migrated email entry retains its identity and related history. Database constraints reject invalid contact combinations; nullable contact values render safely across admin and historical email views.
6. Phone search tolerates punctuation. Contact-method filtering produces consistent rows, totals, selected IDs, metrics, and saved-cohort results, including existing cohorts without the new field.
7. Mixed email audiences show an explicit phone-skipped count and send only to eligible email contacts. An all-phone audience cannot start a send. Send-time checks still exclude a phone contact, and existing spam/subscription/claimed-invite exclusions continue to work.
8. An admin can copy both link types distinctly. Invitation retries and concurrent email/manual requests reuse the same claimable invitation; revocation, placement warnings, and error states remain correct. Copying sends nothing and changes no mobilization state. Its claim connects the resulting account to the waitlist entry.
9. Staff opt-out is authorized, persisted, auditable, and idempotent. Duplicate signup leaves it in place. Contact changes remain unavailable, and no phone-specific operation changes a member's notification preferences.
10. The approved form copy and channel-neutral mobilized copy render in their respective states. Frontend, admin, and backend checks cover their changes; shared phone tests continue to pass if shared components or utilities are touched.

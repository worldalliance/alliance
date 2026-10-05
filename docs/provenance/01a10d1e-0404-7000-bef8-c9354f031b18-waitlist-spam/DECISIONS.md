# Decisions

## Detection

- **Reason-only heuristic.** The old join-request rule needed both the name and the reason to look random. On staging (2026-10-05), 9 of 12 waitlist entries had a random mixed-case reason of 16–23 letters and an ordinary "First Last" name, so the old rule would have flagged none of them. Checking the reason alone flags all 9 and none of the 3 real entries. Entries without a reason (organization-link signups) can't be judged, so they stay `Clean`.
- **Detection runs only on insert.** On a re-submit with a known email, the `ON CONFLICT DO NOTHING` insert leaves the row unchanged, and the request sends no email and sets no cookie, so there is nothing to check.
- **The response doesn't reveal the flag.** A flagged signup gets the same 200, code, and cookie as a real one, so the bot can't tell it was caught.
- **No LLM.** The server has no LLM client. An LLM would need a new dependency and key, a background call, a decision on what happens when the call fails, and would send entrant PII to a third party. The regex is enough for the current bot. An LLM can be added later and set the same `Suspected` value.

## Data

- **`WaitlistSpamStatus` enum: `Clean`, `Suspected`, `Spam`, `NotSpam`.** The regex sets `Clean` or `Suspected`, and staff set `Spam` or `NotSpam`. That keeps "the regex flagged it" separate from "staff ruled on it". The column defaults to `Clean`, so existing rows need no data migration.
- **Spam-like states.** `Suspected` and `Spam` skip email and drop out of public counts. `Clean` and `NotSpam` don't. Code that checks this goes through a `Record<WaitlistSpamStatus, boolean>`.
- **Staff changes are recorded.** New `WaitlistEntryActionKind` values `mark_spam` and `mark_not_spam` go in `waitlist_entry_action`, written only when the status actually changes, the same way mobilization is recorded.

## Email

- **Every public send skips spam.** `WaitlistMailService.sendShareLink` returns early for spam-like entries, so it covers both the confirmation and the link-request email. The link-request endpoint keeps answering the same way.
- **Staff bulk emails skip spam.** A new `WaitlistEmailSkipReason.Spam` sits next to `Unsubscribed` / `InviteClaimed`. If the bot uses real people's addresses, any email to them is the harm being avoided.
- **Unmarking doesn't send the missed confirmation.** Staff can include the entry in a normal bulk email.

## Admin

- **Filter.** `WaitlistEntryFilterDto.spamStatuses?: WaitlistSpamStatus[]` works like `inviteStates`. The server applies no hidden default. The admin waitlist page starts with `[Clean, NotSpam]`. Existing saved cohorts don't have the field, so they still match spam. The email skip reason keeps that from sending email.
- **Metrics follow the filter**, like the rest of the admin waitlist page. Only the public `/waitlist/count` and the referral page's organization `entryCount` always exclude spam-like entries.
- **Controls.** A per-row lucide icon toggle with a tooltip, and bulk "Mark as spam" / "Mark as not spam" actions next to the tag and mobilize actions. Rows in a spam-like state are greyed out when visible. Staff can't set an entry back to `Suspected` or `Clean`.
- **Spam entries aren't blocked from mobilizing or invites.** Bulk actions apply to the filtered list, which excludes spam by default.

## Implementation

- **Where the rule lives.** `WaitlistSpamStatus` sits in the entry entity, next to the column, the way `WaitlistEntryActionKind` sits in its entity. The detector and the server's `SPAM_LIKE` record are in `server/src/waitlist/waitlist-spam.ts`. The admin has its own `Record<WaitlistSpamStatus, { label, spamLike }>` for labels, greyed rows, and the starting filter. The generated type is a string union, so the server enum can't be shared without a cast. A new server status still breaks the admin build until someone adds it there.
- **Staff endpoints.** `POST /waitlist/admin/entries/mark-spam` and `mark-not-spam` take `entryIds`, the same shape as `mobilize`/`unmobilize`. One CTE updates the rows whose status differs and records an action for each. `recordMobilization` now takes only the three mobilization kinds, so its `Record` doesn't have to list the spam kinds.
- **Skip order.** A bulk email checks unsubscribed first, then spam, then claimed invite. The preview gains a `spam` count. With three possible skip groups, the admin's "Skips …" text uses `Intl.ListFormat` to join them.
- **Clear filters returns to the starting filter**, so spam stays hidden, and the button shows only once the filter differs from it. The Spam multi-select shows what is applied. A cohort saved from the starting filter keeps `spamStatuses`, so new cohorts leave spam out.
- **The per-row toggle doesn't ask for confirmation.** It changes one entry, can be undone, and the row disappears from the default view once it's marked. The bulk actions do ask, like the mobilize actions next to them.
- **Migration.** `migration:generate` also produced statements recreating `friend.lowUserId` / `highUserId` (generated-column metadata drift in the local db). They were removed because they aren't part of this change.

## Out of scope

- Slack posts for waitlist signups.
- `scripts/sync_prod_to_staging.sh` doesn't anonymize `waitlist_entry`. The agent noticed this and left it for a separate task.

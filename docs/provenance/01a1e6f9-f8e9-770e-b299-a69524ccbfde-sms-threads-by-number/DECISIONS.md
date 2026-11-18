# Decisions

The user deferred every design question and every listed default, so each choice below is the agent's, and a later agent may change one that causes friction, within REQUIREMENTS.md. What the user deferred is how the work is done, not whether it happens. Per REQUIREMENTS.md 2, each question went to a codex subagent given the options unranked; where it differed from the agent, that is noted. Sources are in EVIDENCE.md. Decisions 3 and 7 supersede requirements of `docs/provenance/01a1c8bb-da2e-7400-b37b-cbd09b464582-member-sms-chat`, the task that added member threads and Needs reply; its other requirements stand. The branch was rebuilt on `main` after `docs/provenance/01a1e5b4-c35c-73d0-bb63-4b9e36ad6729-mark-texts-handled` (Mark handled) and `docs/provenance/01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone` (phone verification) landed there; decisions 2, 3, 4, 7 and 8 record how it was reconciled with them, and REQUIREMENTS.md 4 to 7 hold what the user decided for it.

## 1. Staff reply to non-members; they start texts only to members

Staff may send in a thread with a member on its number, as today, or in a thread whose number sent an inbound text in the last 30 days. Past that, the composer is disabled and says the number has to text in again. There is no way to start a thread with a number staff type in. The codex second opinion agreed, on the reply-only rule. The 30 days is agent judgement: no source sets how long an inbound text's consent lasts, and Twilio recommends reconfirming after "a significant amount of time", which matters because decision 8 brings years-old texts into threads. Basis: EVIDENCE.md, "Consent for staff texts".

## 2. One opt-out state per number, read by every sender

Opt-out state moves from `user.phoneNumberUnsubscribed` to a nullable state on the per-number thread row (decision 4), null until something sets it, so a STOP holds whatever accounts exist for the number, before or after it. The codex second opinion agreed. Basis: EVIDENCE.md, "Opt-out records".

Steps, per the root `AGENTS.md` **Breaking changes**:

1. Expand reads: `MmsService.sendMmsResult`, which `sendMms` wraps, returns `SendErrorKind.Refused` without sending to a `to` number that is opted out, and without the SMS-failure alert its other failures raise, since a member's own STOP is no fault; a cron delivery attempt records such a text failed rather than sending it again, as for any other refusal. `MmsThreadService`, the only caller of `sendStaffText`, refuses staff texts to one, so every sender except login codes and KORA review notices (see Separate work found) is covered whatever user it loaded. Until step 5, a number also counts as opted out while any user with it has the flag, as `BACKCOMPAT(number-opt-out)`, so a STOP an old server records in the flag alone still holds. Code that reads `phoneNumberUnsubscribed` only to show reachability or choose channels keeps reading the flag until the ratchet. The flag can then disagree with the number's state for a member who changed number; sends are still refused at send time.
2. Expand writes: STOP, START and "Mark opted out" set the thread row's state, creating the row if needed, as well as the user flag, and a STOP or START from a number with no member sets it too. They write it inside the `lockPhoneNumber` transaction `docs/provenance/01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone` gave them, after the user rows, and keep its audit of only the live members the update changed. `MmsOptout.userId` becomes nullable, so a non-member STOP gets an audit row. Changing a member's number, by code or by the no-code profile save, is a writer too (the form-answer save reaches the profile save through `UserService.update`; the notification defaults it also saves are channel switches, not opt-out): the member's flag takes the number's opt-out as readers see it, the row's state or any holder's flag, rather than the holders' flags alone, and a member whose flag opted out the number they leave records that opt-out in the left number's state, so it stays with that number. Nothing assumes one account per number, since `UQ_user_phone_number_live` isn't created yet (ALL-2259).
3. Ratchet: stop setting the user flag. START keeps clearing it until step 5, since readers still count it.
4. Migrate: create a row for every number a flagged user or an opt-out record names, then set the state of every row where it is null, and only there, so a write from step 2 during the migration stands. A number is opted out when any user with it has `phoneNumberUnsubscribed`, or when its latest opt-out record is a STOP. The records are `MmsOptout` rows (member STOPs and staff marks), `mms` rows with a `keyword`, `SmsResubscribe` event log entries' `blob.phoneNumber`, and `SmsUnsubscribe` entries with no user, which hold the number only in their message, worded differently before and after `main`'s typed event payloads (`docs/provenance/01a1f067-6739-72a0-852d-fa30e18df18e-slack-message-copy`). Where the flag and the records disagree, opted out wins.
5. Contract: drop the fallback, then the column. A number with no row, or a null state, is subscribed.

The steps ship as separate PRs, each once the previous is live. The first PR holds the table, expand reads and expand writes together, because REQUIREMENTS.md 3 puts the code in one PR, and REQUIREMENTS.md 6 accepts the gap that leaves. That departs from **Breaking changes**, since a rolling server deploy isn't atomic and a release can be rolled back: a STOP handled by a new server and then a START by an old one, during the deploy or after a rollback, keeps refusing the number under the new release until it texts START again. The ratchet PR also moves those reachability readers to the number state (ALL-2297). The migrate step can't ship with the table: the old server keeps running while the migration runs, so a STOP in that window would write only the user flag after the backfill had read it.

Behaviour change to note in the PR: today a profile update leaves the flag with the user when they change their phone number; verifying a number by code already moves it with the number. Afterwards the opt-out stays with the number, so their new number is textable and their old one is not.

## 3. Needs reply per number, plus a Texts page

- Needs reply has one row per number with an unanswered inbound text, longest waiting first. Opted-out numbers are left out, as opted-out members are today, and so are numbers whose texts staff marked handled (decision 7). A row names the non-deleted members with that number, or shows the formatted number when there are none, and links to the thread page.
- A new Texts page, with an entry in the admin sidebar, lists every thread by its latest text, newest first, paginated, and can be searched by phone number. Without it, an answered or opted-out non-member thread has no way in.

This supersedes `docs/provenance/01a1c8bb-da2e-7400-b37b-cbd09b464582-member-sms-chat`'s requirements that Needs reply lists members, that its sidebar badge counts members, and that a row's wait runs from the member's oldest unanswered text: each is per number, with that task's rules for which texts count unchanged. The agent first recommended Needs reply alone. The codex second opinion's point about unreachable threads changed that. Basis: EVIDENCE.md, "Inbox products".

## 4. A thread row per number, addressed by an opaque id

A new table holds one row per number: a UUID id, the E.164 or raw sender number (unique), the opt-out state (decision 2) and the launch cutoff (decision 8). Marking handled lives on the texts and in `mms_thread_event`, as `main` already stores it, not on the row. Rows are created by upsert on any inbound text, staff text or opt-out; automated texts alone make none. URLs and new endpoints take the UUID, so phone numbers stay out of URLs. New endpoints take their own path, `mms-threads/by-id/:threadId`, since `mms-threads/:userId` would catch a UUID and reject it. The codex second opinion agreed. Basis: EVIDENCE.md, "Phone numbers in URLs".

`scripts/anonymize/anonymize.sql` rewrites the table's numbers in step with `mms`: a member's number as today, and each other number to its own synthetic `+1555` number above the member range rather than the shared placeholder, so staging keeps non-member threads apart and the unique constraint holds.

The user-id endpoints (`GET/POST /mms-threads/:userId`, `POST /mms-threads/:userId/opt-out`) stay as a `BACKCOMPAT(mms-thread-ids)` fallback until no deployed admin build calls them, then go. The admin bundle and the server deploy separately.

## 5. The member page keeps its texts section

`MemberTextsSection` keeps showing the thread for the member's current number, with history, composer and opt-out button, and links to the thread page. On the thread page, the composer's quiet-hours warning uses the time zone of the number's member when it has exactly one, and is skipped otherwise. Its internals are extracted into a thread component shared with the thread page, with the query cache keyed by thread id so both views stay in step. The codex second opinion agreed. EVIDENCE.md, "Inbox products", found no established practice either way.

## 6. No "attach to member" action

Staff connect a number to a member by changing the member's phone number through existing member editing, and the thread then names them. Change a number only to correct contact details. The codex second opinion agreed. Inbox products do commonly offer an attach or merge action with a confirmation step (EVIDENCE.md, "Inbox products"), so add one if staff need it.

## 7. Mark handled and Mark needs reply on the thread page too

Per REQUIREMENTS.md 4 and 5, staff clear a Needs reply row with `docs/provenance/01a1e5b4-c35c-73d0-bb63-4b9e36ad6729-mark-texts-handled`'s "Mark handled" and undo it with "Mark needs reply", unchanged in meaning: each marks the number's unanswered texts through the newest text the page shows (`throughId`), records an `mms_thread_event` with who and when, shows that event as a line in the thread, and a later inbound text brings the number back. The thread page addressed by id gets the same controls through `POST mms-threads/by-id/:threadId/handled` and `/needs-reply`, beside the member endpoints, and its thread reports the same `replyState`. Both pages share one header control, so a label, a pending state or an error toast can't differ between them. The marking code moves, unchanged, with the Needs reply query into `MmsInboxService`, which keeps `mms-thread.service.ts` under the 500-line limit; a codex subagent asked for splits proposed the same boundary. No data `main` already holds is reshaped: existing events and `handledEventId` links are read as they are. This supersedes `docs/provenance/01a1c8bb-da2e-7400-b37b-cbd09b464582-member-sms-chat`'s requirement that only a staff text clears a member's Needs reply status, as `docs/provenance/01a1e5b4-c35c-73d0-bb63-4b9e36ad6729-mark-texts-handled` already did for the member page. There is no separate "No reply needed" marker, and the thread page shows no "Waiting …" line, since Needs reply shows each wait.

## 8. Only texts after launch enter Needs reply

For every number with no non-deleted member when the migration runs, as decision 3 names members, a migration sets `mms_thread.launchCutoffId` to the number's newest inbound text. Needs reply, the thread's `replyState` and Mark handled count only inbound texts after that cutoff, through the unanswered-text rule they share, so old texts stay browsable on the Texts page without flooding the queue. That includes numbers held only by deleted accounts, which today's queue already leaves out. Numbers with a non-deleted member keep today's queue. The codex second opinion preferred putting every old text in the queue, for completeness.

The cutoff is a column only the migration writes, not a marked-handled event, because of `main`'s code that keeps running after this deploy. The server and admin bundle it replaces label only the two existing event kinds and read a null `markedById` as "Deleted user", and an event inserted by the migration would reach them, through the old server during the deploy or after a rollback and through older admin bundles still open, as a mislabelled line such as "undefined by Deleted user". A new event kind would also need its enum value committed before the migration could use it, which TypeORM's single migration transaction doesn't allow without recreating the type. The cutoff is fixed when the migration runs, so a number that later gains a member keeps its old texts out of the queue rather than changing meaning with membership. What it gives up: Mark needs reply can't bring a pre-launch text back, and a pre-launch thread shows no line saying why it isn't waiting; staff can still reply to it. Basis: the old admin's labels and `markedById` handling, read in `MemberTextsSection` on `main`, and PostgreSQL's rule that a value `ALTER TYPE … ADD VALUE` adds can't be used in the same transaction.

## 9. Threads follow numbers, not people

A thread shows the members who currently have its number. When a member changes number, their old number's history stays in that number's thread. Recycled numbers mix owners' histories. Ownership periods aren't tracked. The codex second opinion agreed. Basis: EVIDENCE.md, "Inbox products" (Zendesk on shared numbers).

## Defaults

- Any admin can read and send in any thread, as `AdminGuard` allows today. No rule requires a dedicated role (EVIDENCE.md, "Access control").
- A thread whose number isn't textable (a short code, an alphanumeric sender, anything `textableNumber` rejects) is shown read-only, as a member with an invalid number is today.
- Non-member threads get the "Mark opted out" button, for opt-outs in the sender's own words, which Twilio's keyword matching misses. FCC rules require honouring them unless every text discloses an exclusive revocation method, and staff texts don't (EVIDENCE.md, "Opt-out records" and "This repository's code").
- Non-member media is stored, copied to S3 and shown as member media is.
- The Needs reply sidebar badge, now counting numbers rather than members, stays the only staff alert.
- `MmsService.sendStaffText` takes the thread instead of a user id for its logs.
- The branch comes onto `main` (REQUIREMENTS.md 7) by rebasing, never by merging `main` in, as `agents/skills/review-loop/SKILL.md` requires, so each commit can be reviewed against one parent.

## Out of scope

Assigning threads to staff, outbound media, creating a member or sending an invite from a thread, deletion or export requests for a non-member's texts, logging thread views, translation, analytics, a block action, and quiet-hours warnings for numbers without exactly one member.

## Separate work found

Reconstructed from existing code; not changed by this task.

- One-time login codes go through `MmsService.sendUnrecordedText` (`server/src/otp/otp.service.ts`), which checks no opt-out. A code the person asked for may well be exempt; that needs its own check.
- KORA review notices to participants with no email (`server/src/kora/kora-notify.service.ts` `contact`) go through `sendUnrecordedText` too, so they ignore a number's opt-out; until that changes, only Twilio's block list stops them to a number that sent STOP.
- UK numbers get texts from the alphanumeric sender "The Alliance" (`server/src/mms/mms.service.ts`), which Twilio documents as one-way, so they can't reply.

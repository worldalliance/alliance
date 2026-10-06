# Notification-link click history

Status: implemented; [Implementation choices](#implementation-choices) records where the build departs from or fills in this specification. Automated coverage: the tests the implementation commits add or change. Not exercised: real browsers and devices, Twilio and Mailgun sends, production data, and reminder-metadata edits or PostHog outages, which hold by construction only. The interview is complete. [REQUIREMENTS.md](./REQUIREMENTS.md) records the user's request and approval of the agent's proposals. The design and acceptance checks below are agent-authored consequences of those choices.

## Completion criterion

A newly sent, in-scope link opened on web or mobile produces one durable event per independent opening, with correct message/channel attribution and available recipient/context data. Replays produce no additional rows, navigation survives recording failure, and retained events support future analysis without PostHog. All acceptance checks below must pass before implementation is considered complete.

## Scope

R1–R2 cover member notifications, including action announcements/reminders, missed-task notices, forum replies, and digests, plus staff-sent waitlist email campaigns. Track every Alliance app link in those messages, including authored links and shared template links. Messages without an eligible link create no click event.

This change does not expand into password-reset/verification mail, automatic waitlist confirmation/link-request mail, unrelated transactional messages, external destinations, push taps, or general page/button interactions. Those are separate from the approved member-notification and waitlist-campaign scope. Preserve existing sending preferences, audiences, unsubscribe behavior, delivery statuses, and native-link routing.

An opening means arrival at the web or native app through a tracked URL, before authentication or destination rendering can remove the tracking parameters. It does not prove that a task was read or completed. A server-only URL that never opens either client provides no app-arrival signal. Preview GETs and email-provider click webhooks are not app-arrival events.

## Message attribution

Persist attribution when preparing each recipient's channel-specific message, before handing it to the delivery provider. Use a new opaque tracking ID for every new email or SMS delivery record. A reminder sent by both channels has two IDs; every eligible link within one message can share that message's ID.

Build the channel's content using its own ID, including template replacements. Preserve functional query parameters, fragments, invite/referral codes, and destination behavior. Tracking modifies links without introducing a redirect service. Reuse the repository's Alliance-host recognition and URL utilities; use a maintained parser for HTML links if the existing rendering path cannot provide them structurally.

Use one shared persisted attribution representation for mail and SMS, so recipient ownership and reporting context have the same meaning across channels. Its logical contents are:

| Data             | Contract                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tracking ID      | Unique for newly prepared messages and opaque to the client.                                                                             |
| Message          | Reference to the actual mail or MMS record; preserve provider-send outcome separately from clicks.                                       |
| Channel          | Email or SMS for new messages; unknown is permitted for ambiguous legacy links.                                                          |
| Recipient owner  | Member account or waitlist entry, captured at send time using a stable ID.                                                               |
| Source           | Notification category or waitlist campaign, with available source-record IDs.                                                            |
| Context snapshot | Reminder/action/campaign IDs and reporting labels, notified action IDs and copy/experiment identifiers when the sender already has them. |
| Timing           | Message creation and send-acceptance time when available; acceptance is not proof of delivery.                                           |

Store context once per message, rather than copying it into every click. Its snapshot remains usable after a reminder is edited or removed. Existing message records supply body/content where retained; the analytics snapshot does not need another personalized body, email address, or phone number. A nullable live reference must not erase the historical context snapshot.

Waitlist campaign tracking must retain the campaign, campaign-recipient, and resulting mail association. It must work for recipients who have never had an account. Preview/test sends do not manufacture campaign-recipient attribution or enter campaign totals.

Recipient attribution always describes the intended recipient. A forwarded link continues to refer to its source message; the signed-in visitor neither replaces that owner nor grants access to any owner's data. Tracking IDs authorize only recording that a link was opened.

## Click records

Store individual click rows in Postgres. A record contains:

- A client-generated opening ID with a database uniqueness constraint for idempotency.
- The persisted message attribution reference.
- The destination as a normalized Alliance route, with safe content IDs where available.
- The client's observed opening time and the server's receipt time, both in UTC, so delayed retries are distinguishable from immediate ingestion.
- The receiving platform: web or native mobile.
- Whether attribution comes from a new message or a recoverable legacy link.

Remove tracking parameters from destination metadata. Authentication, verification, invite, unsubscribe, and other bearer tokens must not enter analytics destinations or PostHog properties; use route templates when the path itself contains such a token. Preserve those tokens in the actual navigation URL where the destination requires them. Do not store raw query strings, fragments, IP addresses, user-agent strings, or browser fingerprints in these new records.

The server derives recipient, channel, message, and source context from the tracking ID. It validates event IDs, timestamps, platform, and normalized destination before writing. Client observations are analytics data, not evidence for authorization or member obligations.

Different destinations in a message remain distinguishable. Two occurrences of the same destination need not have separate placement IDs; button-versus-footer comparison is outside the agreed data contract.

## Opening lifecycle and retries

1. A shared web entry handler or native incoming-link handler detects a tracked arrival across routes, including logged-out entry points and group links.
2. Allocate the opening ID and observed time once for that arrival. Persist the minimal event payload locally before removing tracking parameters from the visible URL or handing off through sign-in.
3. Send the event without awaiting it on the navigation path. Authenticated and unauthenticated visitors use the same attribution rules.
4. An atomic server operation inserts the event and updates any unambiguous message's existing `clickedLink` flag. A repeated opening ID returns success without inserting or emitting another notification-click event.
5. Remove acknowledged events from the local queue. Retry transport failures, rate limiting, and temporary server failures with bounded backoff while the app is running, on connectivity recovery, and on later startup, until 24 hours after the original observation.

The same arrival keeps its ID through component rerenders, refresh, browser-history restoration, sign-in redirects, and duplicate native initial/live-link delivery callbacks. A separate reopening of the original notification URL receives a new ID, even if it occurs soon afterward. Do not deduplicate by recipient, destination, tracking ID alone, or a time window that would merge intentional openings.

Capture at a shared entry point; remove competing page-level capture so one opening is not recorded by both. Preserve existing notification-read side effects only where the link already has a valid association with an in-app notification. Opening a forwarded link grants no additional notification access.

Queued payloads contain the opening ID, tracking ID, normalized destination, platform, and observed time, rather than full URLs or account data. Login redirects across the supported Alliance domains must retain the same opening identity if both apps observe that navigation.

A duplicate acknowledgement is terminal success. Invalid input and unknown, revoked, or deleted-recipient tracking IDs are terminal rejections: discard them and let navigation proceed. Queue expiry also ends retries. Browser storage being unavailable falls back to an immediate best-effort request; expose failure through existing diagnostics without showing the visitor an analytics error. Closed apps cannot promise background execution: persistence enables retries when they next run within the deadline.

## Legacy links and rollout

Apply additive schema/API changes first, then update senders and clients. Leave already sent URLs valid. An older client that only sends `cid` must continue to receive a compatible response; its report can update an unambiguous historical flag, but cannot claim the new guarantees about independent openings or retry deduplication.

For new clients opening an old URL, resolve existing message/source records using its original tracking ID. Recover attribution only from durable associations; do not assign historical ownership by matching a message address to whoever currently uses it. If both email and SMS share the ID, retain the candidate message associations and mark channel/message selection as ambiguous instead of preferring SMS. Such an event cannot increase either channel's known-click count.

Legacy records without recoverable recipient ownership remain on the existing summary-flag path. This preserves deletion guarantees and avoids presenting guessed ownership as known history. New messages always receive explicit ownership. New response fields expose unknown attribution to updated clients without relying on the old `mms` boolean.

Keep existing `clickedLink` values. They represent historical evidence that at least one click was recorded, with known limits in coverage and channel attribution. Do not create dated click rows from those booleans or treat `updatedAt` as the click time. The user's optional permission to stamp historical data with the current time is unused because leaving the time unknown avoids false timing information and needs no synthetic backfill.

An observed opening after rollout has its own event time even when its source link is old. PostHog history import and reconstruction of unrecorded openings remain separate work.

## Retention and deletion

Click history has no scheduled expiry. Reminder/action/campaign metadata edits or removal must not cascade into the historical message context or click rows.

Recipient deletion removes their click rows and the analytics attribution that would allow old tokens to recreate them. This applies to member-account deletion and waitlist-entry deletion, including explicit existing associations from a converted waitlist recipient to a deleted account. Use those stable associations rather than inferring identity from an email address. This feature does not introduce new account/waitlist deletion controls.

Concurrent or delayed event submissions must not resurrect deleted data. Deletion and ingestion need compatible database constraints/transactions, including for lazily recovered legacy links. A queued event for a deleted owner receives a terminal response when retried. Forwarding does not change which recipient's deletion controls the event.

## Existing reporting

The reminder chart continues to measure distinct clicked messages divided by sent messages, using its existing sent-message eligibility. Ten openings of one SMS count as one clicked SMS in that chart. New event ingestion keeps the summary flag compatible; do not sum old flags and new rows as independent clicks.

Historical flags stay visible with their existing limitations. Newly ambiguous legacy events cannot be credited to a chosen channel. Waitlist campaign rows must not enter reminder-group totals. No new dashboard, raw-event listing, or reporting endpoint is part of this work; existing reporting keeps its current admin access controls.

Emit the notification-click PostHog event from the server after the first successful event insert, using the persisted event ID and attribution. Remove the competing client emission for the updated path. Keep existing Mailgun delivery/open/click reporting as separate provider events. PostHog delivery is best-effort and must not roll back database capture; no new PostHog delivery queue is required. The database remains the source for complete recorded history.

## Acceptance checks

Use synthetic recipients and links. Establish failing regression tests for the existing attribution and destination-coverage gaps before implementation.

| Scenario                                                                            | Required result                                                                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| One reminder delivered by email and SMS                                             | Different tracking IDs; opening either marks and attributes only its channel.                         |
| Tasks, action, forum, group, and public/signup arrivals                             | Each eligible route records an opening, including logged-out arrivals; sign-in creates no second row. |
| Multiple links within a message                                                     | Correct normalized destination for each; functional query parameters and fragments still work.        |
| Waitlist campaign to a recipient without an account                                 | Click joins to the campaign, recipient, and mail; preview/test mail does not inflate campaign totals. |
| Recipient forwards a URL                                                            | Original message ownership remains; the visitor's account is not substituted.                         |
| Repeat intentional opening                                                          | A second event is stored, while the chart's unique-message numerator remains one.                     |
| Refresh, rerender, history restoration, auth redirect, or duplicate native callback | The original opening ID is reused or no new capture occurs.                                           |
| Two requests for one opening race, or the success response is lost                  | One committed event, one compatible summary update, and at most one new server PostHog emission.      |
| Network/API outage followed by app restart within 24 hours                          | Navigation works; the persisted event is retried with its original ID and observation time.           |
| Queue reaches its deadline or receives a terminal rejection                         | Retrying stops without navigation errors. Storage failure has an immediate best-effort path.          |
| Ordinary preview fetch or Mailgun click webhook                                     | No app-arrival row is inserted.                                                                       |
| Invalid payload, tracking ID, platform, timestamp, or destination                   | Server rejects it without inserting rows; the destination still opens on the client.                  |
| Legacy ID matches one recoverable message                                           | New clients record the observed opening with recovered attribution.                                   |
| Legacy ID matches both channels, or has no durable owner                            | Ambiguity stays explicit; no invented channel/owner or reconstructed historical event.                |
| Historical flag exists before migration                                             | Its value is preserved; migration creates no fabricated click timestamp.                              |
| Reminder metadata changes or is deleted                                             | Stored reporting context still describes the message when sent.                                       |
| Recipient deleted before, during, or after ingestion                                | Associated events are removed and delayed submissions cannot recreate them.                           |
| Destination contains a credential or private token                                  | Navigation retains what it needs; analytics payloads and diagnostics omit that value.                 |
| PostHog is unavailable                                                              | The database event and normal navigation still succeed.                                               |
| Existing chart reads mixed historical and new data                                  | Unique-message counts remain compatible; events and flags are not double-counted.                     |
| Web/native parity and routing                                                       | Both clients satisfy opening/retry rules without changing which app ordinary links launch.            |

During implementation, run the repository's required package checks and exercise the affected web/native flows under the applicable skills. Passing them does not establish production collection, deployment, or retention health.

## Implementation choices

Agent decisions made while implementing, after the user asked for the feature to be built and allowed these decisions to change.

- **Tables.** `message_tracking` holds attribution, one row per tracked email or text; `link_opening` holds openings. Whether attribution was recovered from a legacy link is `message_tracking.legacy`, which each opening inherits rather than repeating. Owner columns (`userId`, `waitlistEntryId`, exactly one set) cascade on delete, and openings cascade with their attribution. A recipient deletion racing an ingestion fails the opening's foreign key, which the endpoint answers as an unknown tracking ID.
- **Message reference.** Attribution reaches its `Mail` or `Mms` row through `cid`, which holds the tracking ID, rather than a foreign key: an `Mms` row is written only after Twilio answers, sometimes after the sender has returned. `mail.cid` and `mms.cid` are now indexed. Campaign and campaign-recipient IDs sit in the context snapshot, not columns.
- **No acceptance timestamp.** `Mail.status` and the time an `Mms` row is written already say whether the provider accepted, and `Mail` keeps no acceptance time to copy.
- **Tagging at send.** `MailService.sendMail` and `MmsService.sendMms` take a `tracking` input, mint a 12-byte base64url ID, and add `cid` to every app link in the final HTML (cheerio) or text (markdown-it's linkify). This covers authored links, but not a waitlist entrant's share link: it is passed on, so its openings aren't the recipient's. `#{link}` and `#{grouplink}` no longer carry an ID themselves, so reminder previews contain none. The ID's 16 characters keep texts short and never match the legacy 10-hex-digit format.
- **Scope.** Action announcements and reminders, missed-suite notices, action-update recognitions, forum replies, forum digests, contract reminders, and waitlist campaign sends are tracked. A recognition's copy is frozen at preparation without an ID, and each channel is tagged when sent, so `action_update_exposure.cid` is no longer written. A failed tracking insert fails the text or email like a failed send. Contract-suspension messages contain no app link, and the opt-in text and test sends are untracked.
- **Endpoint.** New clients call `POST /link-openings`, which is signed-out, throttled per IP at 60 a minute and 600 an hour, and answers 204, 400, 404, or 429 when throttled. An opening observed more than an hour in the future, or more than 25 hours ago (the deadline plus an hour of clock skew), gets a 400. Clients retry on no response, 408, 429, or 5xx, and drop the opening on anything else. `/notifs/linkClick` keeps its contract for cached old web bundles, including crediting the text first when an old email and text shared an ID; it still works for new links, since their `cid` matches the message rows. New clients need no response fields, only success or a final refusal, so none were added.
- **Destinations.** A destination is the path plus whichever of `tab`, `replyId`, and `communityId` have safe values. A path segment outside `[\w.-]`, or longer than 128 characters, becomes `:param`. A destination longer than 512 characters keeps only its first segment. No current route carries a token in its path. The server stores its own normalization of the client's destination, so a client normalizing differently still records its opening, up to 512 characters of raw destination, and rejects one that isn't a path.
- **Legacy recovery.** A pre-tracking ID is attributed only through the `ActionEventNotif` or `ActionUpdateExposure` that sent its mail or MMS, and only when that one record sent every message carrying it: legacy IDs have 40 random bits, so two recipients' messages can share one. Group and action names come from the current records, which are the only durable source; a personal reminder whose group was deleted takes its action from its own event. An ID with no owner sets its message's flag only when exactly one message carried it; the response is still 204, so the client stops retrying, and no event is stored or sent to PostHog. A pre-tracking ID whose member was deleted reaches the same path, instead of the terminal rejection the specification gives deleted recipients: the deletion left nothing that ties the ID to a recipient. Recovery looks up the ID's mail and MMS rows first and answers 404 when neither exists.
- **Notification read.** An opening marks the in-app notification read through the reminder's `ActionEventNotif.notificationId`. An opening of a legacy link also reads any notification sharing its `cid`, as forum replies did before tracking. The in-app entries of new missed-suite notices and streak-recognition reminders no longer get a `cid`; `/notifs/linkClick` finds them through the tracking row instead, so the entry's `notificationId` is saved before its text or email goes out.
- **PostHog.** The server's `notif_link_click` uses the owner as its distinct ID, or `waitlist_entry_<id>` for a waitlist owner, whose events make no PostHog person, since nothing would merge or delete it. It keeps the old `cid`, `platform` (`mms`/`email`/`unknown`), and `actionId` properties so existing insights still match. `actionId` is now the reminder's action from the context snapshot, not the action of the page viewed, and is absent for forum, waitlist, and contract-reminder messages.
- **Web capture.** Capture runs in `entry.client.tsx`, before hydration, so no auth redirect sees `cid`. The session still gets `cid` through `register_for_session`, in PostHog's `loaded` callback, since registering before PostHog initializes does nothing. The server redirects for `/join`, `/description`, and old project URLs keep `cid` for the page they land on. The notification list reloads after a queue pass settles an opening, which marks its notification read.
- **Mobile capture.** Capture runs in `+native-intent`. The same URL delivered twice within 2 seconds counts once, which covers iOS delivering a cold-start link as both the initial URL and a URL event. Retries fire on returning to the foreground instead of on connectivity events, because NetInfo is a new native module that would change the fingerprint runtime and block OTA updates. Hermes lacks `crypto.randomUUID`, so opening IDs fall back to `Math.random`; they only need to be unique. The notifications cache reloads after a queue pass settles an opening, as on web.
- **Queue storage.** Storage updates run one at a time and reread storage, and an opening recorded during a pass gets another pass. When storage fails, the specification's immediate best-effort request becomes an in-memory opening, sent from `start()` and retried with backoff while the app runs. A send unanswered after 30 seconds is retried. Every refusal but a 404 is reported as `link_opening_refused`; a 404 is an unknown or deleted recipient and stays quiet. A stored entry that no longer parses is dropped and reported as `link_openings_unreadable`, and the rest are kept.
- **Queue start.** The shared queue sends nothing until `start()`. Otherwise a web send could go out before the API client has its base URL, and the frontend origin's 404 would end that opening's retries.
- **Converted waitlist recipients.** `deleteUserAdmin` deletes the attribution of each waitlist entry whose invite the member claimed (`user.referredByInviteId` → `onetime_invite.waitlistEntryId`), in the deletion's own transaction. Another claimant of the same entry does not keep it: the claim is the only stored link to the recipient, and a forwarded invite looks the same, so keeping it could leave a deleted recipient's history behind.
- **Migrations.** `MessageTracking` and `LinkOpenings` each ship with the commit that needs their schema; `LinkOpenings` adds the `legacy` column and `unknown` channel that only legacy recovery writes. The generator also emitted `friend` generated-column statements caused by local schema drift. They were removed; regenerating afterwards shows only that same drift.

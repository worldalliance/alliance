# Evidence

Question: is there an industry standard for a staff-to-member two-way SMS/MMS chat in an admin panel, and what do Twilio, the law and established products say about building one?

Two agent subagents researched this on the web on 2026-11-10. One covered UI conventions and the other covered technical and compliance questions. The findings below are condensed from their reports. Statuses use root `AGENTS.md` **Established practice**: formal standard or law, vendor recommendation, research-backed, common practice. The subagents read search results and help-center pages; they did not use the products.

## Overall answer

There is no formal standard for the UI. Rules exist for what may be sent and when: the TCPA/FCC rules (law), the CTIA Messaging Principles (an industry guideline enforced by carriers), and Twilio's Messaging Policy (a contract). The UI follows vendor guidance and a widely shared common practice.

## UI conventions

- **One chronological thread per contact.** (common practice) Helpdesks route SMS into a shared inbox: [Front](https://help.front.com/en/articles/2022), [HubSpot](https://knowledge.hubspot.com/sms/manage-and-reply-to-marketing-sms-messages-in-your-conversations-inbox), [Intercom](https://www.intercom.com/help/en/articles/6311194-sms-via-the-help-desk), [Zendesk](https://support.zendesk.com/hc/en-us/articles/5514406080538). Texting tools organize by campaign: [ThruText](https://help.getthru.io/support/solutions/articles/44002434429), [Scale to Win](https://support.scaletowin.com/threads-and-reply-management).
- **Delivery status on each outbound message**, using Twilio's statuses (queued → sent → delivered/undelivered/failed). (vendor recommendation) [Twilio status callbacks](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks), [status meanings](https://support.twilio.com/hc/en-us/articles/223134347-What-do-the-SMS-statuses-mean-). Zendesk marks failed messages with a warning icon: [Zendesk](https://support.zendesk.com/hc/en-us/articles/4408843683226-Receiving-and-sending-messages-in-the-Zendesk-Agent-Workspace).
- **Opted-out contacts are shown as such, and replies to them are blocked.** (vendor recommendation) HubSpot disables replies ([HubSpot](https://knowledge.hubspot.com/sms/manage-and-reply-to-marketing-sms-messages-in-your-conversations-inbox)), Sakari hides the composer ([Sakari](https://support.sakari.io/hc/en-us/articles/360039261531)), and Twilio rejects the send with error 21610 ([Twilio STOP filtering](https://help.twilio.com/articles/223134027-Twilio-support-for-opt-out-keywords-SMS-STOP-filtering-)).
- **"Needs reply" (the last message was inbound) is more common than read/unread.** (vendor recommendation) [ThruText statuses](https://help.getthru.io/support/solutions/articles/44002483709-statuses-and-sorting-order-in-the-thrutext-messenger), [Scale to Win](https://support.scaletowin.com/threads-and-reply-management).
- **Unanswered conversations sort longest-waiting first, timed from the customer's first message after the last teammate reply.** (vendor recommendation) Intercom's "Waiting since" sort, ascending, prioritizes customers who have waited longest; the wait "begins at the start of a conversation or from the user's first message after the last teammate reply", and "follow-up user replies, teammate notes, and bot replies don't affect it" ([Intercom inbox sorting](https://www.intercom.com/help/en/articles/6989006-inbox-sorting)). Front offers "Oldest unreplied" and "Newest unreplied" sorts and, when two messages arrive back-to-back, uses the earlier one's timestamp ([Front sorting](https://help.front.com/en/articles/2144)). Both pages were checked on 2026-11-12. Neither makes it a universal default; both offer other sorts too.
- **Segment counter.** GSM-7 allows 160 characters per segment (153 when concatenated) and UCS-2 allows 70 (67); a single emoji forces UCS-2. (formal standard: GSM 03.38) [Twilio](https://www.twilio.com/docs/glossary/what-sms-character-limit). Intercom and HubSpot show the count before sending: [Intercom](https://www.intercom.com/help/en/articles/6311194-sms-in-the-inbox), [HubSpot](https://knowledge.hubspot.com/sms/understand-message-segments-for-sms).
- **MMS support varies.** Front sends and receives it ([Front](https://help.front.com/en/articles/2490)). HubSpot's help desk shows inbound images but can't send them ([HubSpot](https://knowledge.hubspot.com/help-desk/set-up-sms-messaging-for-support-communications)). Intercom discourages sending images ([Intercom FAQ](https://www.intercom.com/help/en/articles/6311206-sms-faqs)). Showing inbound media inline is the common baseline. (common practice)
- **Saved replies fill the composer for editing.** (vendor recommendation) [ThruText](https://help.getthru.io/support/solutions/articles/44001063880-using-recommended-saved-replies-in-your-assignment), [Twilio Frontline](https://live.docs.dev.twilio.com/docs/frontline/templated-messages).
- **Per-message staff attribution** was not documented by any surveyed product. Twilio Conversations gives every message an author ([SDK](https://sdk.twilio.com/js/conversations/releases/2.5.0/docs/classes/Client.html)). (common practice, unverified)
- **Quiet hours:** ThruText defaults to 9 AM–9 PM ([ThruText](https://help.getthru.io/support/solutions/articles/44001063887-texting-hours)). Hustle blocks sends outside configured hours, optionally allowing inbox replies ([Hustle](https://help.hustle.com/hc/en-us/articles/115000521113)). (vendor recommendation)

## 1. Conversations API vs Programmable Messaging

- Twilio positions Programmable Messaging for sending messages, and Conversations for threaded, multi-channel exchanges that Twilio stores. (vendor recommendation) [Conversations overview](https://www.twilio.com/docs/conversations/overview), [Messaging](https://www.twilio.com/docs/messaging)
- Conversations has been renamed "Conversations (classic)", Conversation Orchestrator now sits on top of it, and classic remains supported. No end-of-life notice was found for the API. (vendor recommendation) [SIGNAL 2026](https://www.twilio.com/en-us/blog/products/signal-2026-product-announcements), [Orchestrator GA](https://www.twilio.com/en-us/changelog/conversation-orchestrator-is-now-generally-available)
- When a number pair belongs to a participant in an active Conversation, the incoming-SMS webhook does not fire. (vendor recommendation) [Inbound autocreation](https://www.twilio.com/docs/conversations/inbound-autocreation)

## 2. Data model

- Message statuses: `accepted, scheduled, canceled, queued, sending, sent, failed, delivered, undelivered, receiving, received, read`. Status callbacks can arrive out of order. (vendor recommendation) [Message resource](https://www.twilio.com/docs/messaging/api/message-resource), [Tracking status](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status)
- Webhooks are retried as configured. Twilio advises storing processed IDs and responding quickly. (vendor recommendation) [Connection overrides](https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides), [Security FAQ](https://www.twilio.com/docs/usage/api-security-reference-guide/faq)
- A unique message SID, a direction, a link to the contact, and a nullable sender id are the usual shape. (common practice)

## 3. Inbound MMS media

- The inbound webhook carries `NumMedia`, `MediaUrl{N}` and `MediaContentType{N}`. (vendor recommendation) [Webhook request](https://www.twilio.com/docs/messaging/guides/webhook-request)
- Media stays on Twilio until its Media resource is deleted. Twilio's tutorial downloads the file and then deletes it. With media auth enabled, requests need HTTP Basic credentials. (vendor recommendation) [Media resource](https://www.twilio.com/docs/messaging/api/media-resource), [Receive and download MMS](https://www.twilio.com/docs/messaging/tutorials/how-to-receive-and-download-images-incoming-mms/node), [Media auth](https://support.twilio.com/hc/en-us/articles/223183748)
- Outbound MMS allows up to 10 media items and 5 MB in total. (vendor recommendation) [Error 11751](https://www.twilio.com/docs/api/errors/11751), [Accepted MIME types](https://www.twilio.com/docs/messaging/guides/accepted-mime-types)

## 4. Compliance

- TCPA "telephone solicitation" excludes calls by or for a tax-exempt nonprofit, and the federal 8 AM–9 PM window applies to solicitations. (law) [47 CFR 64.1200](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200)
- Since 2025-04-11, consent can be revoked by any reasonable means, and keywords such as STOP, QUIT, END, REVOKE, OPT-OUT, CANCEL and UNSUBSCRIBE count. (law) [Manatt](https://www.manatt.com/insights/newsletters/tcpa-connect/fcc-adopts-revocation-rules)
- Florida and Oklahoma restrict telemarketing to 8 AM–8 PM in the recipient's time zone. (law; applicability to nonprofit one-to-one replies is unconfirmed) [Venable](https://www.venable.com/insights/blogs/2023/06/florida-limits-its-telemarketing-law-but-other-sta), [Manatt](https://www.manatt.com/Insights/Newsletters/TCPA-Connect/Oklahomas-Mini-TCPA-Takes-Effect)
- CTIA Messaging Principles: consent, honoring opt-outs, and identifying the sender. (industry guideline enforced by carriers) [CTIA](https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf)
- 10DLC campaign samples must match the traffic sent, so a campaign describing only broadcasts should be updated to cover two-way staff replies. (vendor recommendation) [Twilio](https://help.twilio.com/articles/11847054539547), [Use cases](https://support.twilio.com/hc/en-us/articles/1260801844470)
- With Advanced Opt-Out off, Twilio handles STOP only when the whole message is the keyword. (vendor recommendation) [Twilio](https://help.twilio.com/articles/223134027)

## 5. Real-time delivery to the admin UI

- Twilio's tutorials push webhook events over Socket.IO or Twilio Sync. Polling is adequate at low staff counts. (vendor recommendation for the push examples; common practice for polling) [Socket.IO tutorial](https://www.twilio.com/en-us/blog/getting-started-with-socket-io-adding-real-time-events-to-your-node-js-express-app-html), [Twilio Sync](https://www.twilio.com/docs/serverless/functions-assets/quickstart/real-time-data-sync)

## 6. Needs Reply query cost (measurement)

Method: in a copy of the e2e schema on local Postgres 18 (macOS), members, outbound broadcasts and inbound texts were loaded, and `EXPLAIN ANALYZE` was run on hand-written equivalents of the Needs Reply query. Production's row counts were not checked.

- 2026-11-11, the earlier version of the query (each number's newest inbound text with no later inbound or staff text), 200,000 members, 3,000,000 broadcasts and 40,000 inbound texts: without an index matching the later-answer search, Postgres seq-scanned the whole `mms` table for it, 1,715 ms. With a partial index on `("memberPhoneNumber", "createdAt", id) WHERE direction = 'inbound' OR "sentById" IS NOT NULL`, both the inbound scan and the later-answer search used the index: 86 ms.
- 2026-11-12, Postgres 18.3, the current query (each number's oldest and newest inbound text with no later staff reply, `DISTINCT ON` the number), 200,000 members, 3,000,000 broadcasts, 40,000 inbound texts over 10,000 numbers and 20,000 staff replies to them, all 10,000 numbers unanswered: the reply search used the partial index (`Index Scan using "IDX_b8c6f81aed3e503aa3c8604422"`, 40,000 loops) in both searches, 89 ms oldest-first and 81 ms newest-first; the earlier query took 104 ms on the same data.
- 2026-11-12, Postgres 18.3, same data: the single query that replaced the two searches (oldest-first `DISTINCT ON` the number, with `first_value(body) OVER (PARTITION BY number ORDER BY createdAt DESC, id DESC)` for the newest text's body) still used the partial index for the reply search (`Index Scan using "IDX_b8c6f81aed3e503aa3c8604422"`, 40,000 loops); median of nine runs each, 104 ms, against 103 ms oldest-first and 123 ms newest-first for the two searches on a machine whose runs varied by up to 50 ms.
- 2026-11-12, Postgres 18.3, the same data reloaded, with keywords matched by the `keyword` column the webhook records (`keyword IS NULL`) in place of the SQL copy of its matching, and the reply statuses as a positive `IN` list: the reply search still used the partial index (`Index Scan using "IDX_b8c6f81aed3e503aa3c8604422"`, 40,000 index searches), and the inbound rows were found through the inbound-only `twilioSid` index. Nine runs each, alternating with the previous form on the same data while other work loaded the machine: median 308 ms against 296 ms, runs from 216 ms to 1.9 s, so the two are within noise of each other.

## `Mms.sentBy` type cycle (experiment)

Method: on 2026-11-12, at the branch tip after its rebase onto `main` 8196603b37 (TypeScript 5.9.3, TypeORM 0.3.28, macOS), `tsc --noEmit` in `server/` was run fresh (`--incremental false`) and incrementally after appending a comment line to one file at a time.

- With `sentBy?: Relation<User> | null`, the fresh run passed, but an incremental run after editing `src/notifs/record-delivery.ts` or `src/mms/mms.entity.ts` failed, and kept failing once the edit was undone: TS2322 at `record-delivery.ts:27` and TS2345 at `action-update-recognition.service.ts:405`, each tracing `_QueryDeepPartialEntity` through `Mms.sentBy` → `User.optInMms` → `Mms`. Editing `action-update-recognition.service.ts` alone passed. The result depends on the order tsc checks files, not on the code in them.
- With `sentBy?: Relation<Pick<User, "name">> | null`, the fresh run and the incremental runs after editing each of `record-delivery.ts`, `mms.entity.ts`, `action-update-recognition.service.ts` and `user.entity.ts` all passed.

## Staff text length limit (vendor documentation)

Twilio's page for error 21617, "The concatenated message body exceeds the 1600 character limit" (https://www.twilio.com/docs/api/errors/21617), read on 2026-11-12, says the `Body` of an outgoing message can be up to 1,600 characters, and that for SMS, characters outside GSM-7, such as emoji, "can use more space than standard GSM characters and cause the message to exceed the limit sooner than expected." It does not say exactly how Twilio counts them. class-validator's `@Length`, through validator's `isLength`, counts a surrogate pair as one character, so `'😎'.repeat(1600)`, 3,200 UTF-16 code units, passes it (a round 22 reviewer's run).

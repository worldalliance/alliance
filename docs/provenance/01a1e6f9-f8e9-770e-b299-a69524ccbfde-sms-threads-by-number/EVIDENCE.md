# Evidence

Research by a claude subagent and a codex subagent on 2026-11-16 UTC. The claude subagent read the CTIA PDF, Twilio's Messaging Policy and Advanced Opt-Out page, 47 CFR 64.1200 (Cornell LII copy) and the vendor help pages directly. The 2026-10-26 amendment to 47 CFR 64.1200 was read in full from the Federal Register the same day. Status labels are the root `AGENTS.md` **Established practice** categories plus two: regulation, for law, which binds whatever the other categories say, and vendor behaviour, for what a product's docs say it does without recommending it, which counts toward common practice only where several vendors agree. This is not legal advice.

## Consent for staff texts

- CTIA Messaging Principles and Best Practices, May 2023, Exhibit II (common practice: the wireless industry body's published best practice): conversational messages need no further permission when "the Consumer initiates the text message exchange and the Non-Consumer only responds with relevant information". Informational messages need the consumer to "agree to receive texts for a specific informational purpose". §5.1.2.2: an opt-in "should apply only to the campaign(s) and specific Message Sender for which it was intended." https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf
- Twilio Messaging Policy, updated April 2026 (vendor recommendation): "the individual's inbound message to you constitutes both consent and proof of consent", which "does not provide you necessary consent to engage in ongoing recurring engagement." It sets no fixed duration for consent and recommends reconfirming after "a significant amount of time has passed". https://www.twilio.com/en-us/legal/messaging-policy
- Twilio A2P 10DLC (vendor recommendation): registering a campaign declares "how end users can opt-in, opt-out, and receive help". Carrier filtering surfaces as error 30007. https://www.twilio.com/docs/messaging/compliance/a2p-10dlc, https://www.twilio.com/docs/api/errors/30007
- 47 CFR 64.1200(a)(2) (regulation): the nonprofit provision relaxes written consent to express consent; it doesn't remove consent. https://www.law.cornell.edu/cfr/text/47/64.1200
- No source found sets how long consent from an inbound text lasts.

## Opt-out records

- 47 CFR 64.1200(a)(10)–(12) as amended by 91 FR 67214 (FCC, FR Doc. 2026-21821, published 2026-10-26, effective 2026-11-25) (regulation). The text in force before then (Cornell LII copy) requires honouring a revocation made "by using any reasonable method". From 2026-11-25:
  - A sender may designate replying with "stop", "quit", "end", "revoke", "opt out", "cancel" or "unsubscribe" as the exclusive means to revoke, if it "clearly and conspicuously disclose[s] the designated method" in the text; including one of the words in each text satisfies that, provided all of them are recognised. A sender that designates no exclusive means "must process revocation requests made by any reasonable means" ((a)(11)).
  - "Callers may interpret a revocation request made in response to an informational call or text message … as applying only to the specific category of informational robocalls and text messages to which the revocation was directed". This supersedes the revoke-all provision previously postponed to 2027-01-31.
  - Revocations must be honoured "within a reasonable time not to exceed ten business days". (a)(12) allows a confirmation text with no marketing, presumed within consent if sent within five minutes.
  - https://www.federalregister.gov/documents/2026/10/26/2026-21821/enhancing-the-ability-of-consumers-to-control-the-robocalls, https://www.law.cornell.edu/cfr/text/47/64.1200
- A companion FCC notice (91 FR 67239, comments due 2026-11-25, reply comments 2026-12-28) seeks comment on shortening the ten-day window, requiring two-way texting and requiring a revoke-all method. https://www.federalregister.gov/documents/2026/10/26/2026-21820/modernizing-the-ability-of-consumers-to-control-robocalls
- CTIA §5.1.3 and §5.1.5 (common practice): process opt-outs in normal language, case- and punctuation-insensitive, send one final confirmation, and "retain and maintain all opt-in and opt-out requests… to ensure that future messages are not attempted."
- Twilio Advanced Opt-Out (vendor recommendation): default long-code keywords STOP, UNSUBSCRIBE, END, QUIT, STOPALL, REVOKE, OPTOUT, CANCEL. "Twilio checks this list before sending any future outgoing messages", failing them with error 21610. "\"Start\" and \"unstop\" are reserved Opt-In keywords and non-removable" for every number type; the sentence "Only the keywords START and UNSTOP can fully undo the blocking" is in its toll-free section, and the Alliance sends from a long code. It matches keywords only. It "does not support changing or reporting on blocked phone numbers via the Console or the REST API." https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out
- Every source found keys opt-outs to the phone number: CTIA, Twilio's block list, Textline (https://help.textline.com/en/articles/6660355-unsubscribing-to-messaging). Intercom notes "customers who've only ever texted in" can reply STOP. No source sets an expiry for an SMS opt-out.

## Inbox products

All vendor behaviour, read from vendor docs; none documents a standard. Where several agree, that is common practice, as noted below.

- One conversation per contact number: Intercom ("There can only ever be 1 SMS conversation open with a single customer at any time", https://www.intercom.com/help/en/articles/6311194-sms-via-the-help-desk), Front (https://help.front.com/en/articles/2022), Twilio Conversations (errors 50416, 80102), Textline (a conversation starts at the first message or the first after the last resolution, https://help.textline.com/en/articles/6660327-textline-glossary).
- Unknown numbers: Zendesk uses "the calling number as the user name" (https://support.zendesk.com/hc/en-us/articles/10878444999450-Managing-end-user-profiles-for-Contact-Center). Twilio Flex creates an unidentified "New Contact" (https://www.twilio.com/docs/flex/admin-guide/setup/unified-profiles). Liaison TargetX shows conversations without a contact record.
- Shared numbers: "Zendesk cannot identify a user if they are using a shared number." Intercom auto-merges a lead only when one user has the number (community answer, not official docs).
- All-conversations lists beside an unassigned or needs-reply queue (Intercom views, Front's Archived tab, Podium) are common practice.
- Contact context sits inside the conversation view (Flex customer history, Help Scout sidebar). No vendor doc found embeds a full conversation in a separate contact page.
- Attaching a number to a contact: Front "Merge contact with…" with a conflict preview (https://help.front.com/en/articles/2334), HubSpot "+ Add Contact" (https://knowledge.hubspot.com/inbox/create-contacts-in-your-conversations-inbox), Flex manual search and unlink. Help Scout merges can't be undone.

## Phone numbers in URLs

- RFC 9110 §17.9 (formal standard): discourages sensitive information in URIs, since they are displayed and logged by browsers, servers and intermediaries. https://www.rfc-editor.org/rfc/rfc9110.html#section-17.9
- OWASP, information exposure through query strings, and CWE-598 (common practice): URL data leaks through the Referer header, web logs, browser history and cache, and "Simply using HTTPS does not resolve this vulnerability." https://community.owasp.org/vulnerabilities/Information_exposure_through_query_strings_in_url, https://cwe.mitre.org/data/definitions/598.html
- OWASP Logging Cheat Sheet (common practice): telephone numbers may need masking or hashing in logs. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- PostHog session replay (vendor behaviour): captures page URLs; redacting them is opt-in. https://posthog.com/docs/session-replay/privacy

## Access control

- CTIA §5.2.2 (common practice): "reasonable security measures… technical, physical, and administrative safeguards… from unauthorized access". No rule found requires a dedicated SMS role.
- Front restricts shared inboxes to named teammates or groups (https://help.front.com/en/articles/2057). Intercom requires an Inbox seat to send SMS. Textline lets any agent claim conversations. (Vendor behaviour.)

## This repository's code

Read at commit `695ac03d41` on 2026-11-17.

- Every inbound text is stored in `mms` with `memberPhoneNumber` generated from `from` or `to` (`server/src/mms/mms.entity.ts`, `mms-thread.service.ts` `recordInbound`). One that isn't STOP or START also becomes an "Unhandled inbound SMS" event log entry (`mms-unsub.service.ts` `logUnhandledMessage`).
- Thread, send and opt-out endpoints take a user id (`server/src/mms/mms-thread.controller.ts`). `needsReply()` keeps only numbers belonging to a subscribed, non-deleted member (TypeORM adds `deletedAt IS NULL` to its member subquery) and returns one row per member.
- STOP and START update `phoneNumberUnsubscribed` on every user with the number, deleted accounts included, inside the number's advisory lock (`server/src/user/user.utils.ts` `lockPhoneNumber`). `MmsOptout.userId` is required, so a non-member STOP writes no `MmsOptout` row. It leaves an event log entry naming the number and, like every inbound text, an `mms` row, with `keyword = 'stop'` (START likewise leaves `keyword = 'start'`) (`mms.controller.ts`, `mms-unsub.service.ts`).
- Member STOPs and "Mark opted out" (`mms-thread.service.ts` `markOptedOut`) go through `unsubFromMms`, which writes an `MmsOptout` row with the number for each matching user and an event log entry with the user but no number. A staff mark leaves no `mms` row. A non-member STOP's event log entry holds the number only in its message, while `SmsResubscribe` entries carry it in `blob.phoneNumber`, member or not. A profile update leaves the flag with the user when `User.phoneNumber` changes. Verifying a number by code (`server/src/user/phone-verification.service.ts` `verify`) gives the verifier the flag if any account holding the number has it, and clears the number and flag from the other live holders, inside the same lock.
- The Alliance sends from one number, `TWILIO_PHONE_NUMBER`, except to UK numbers, which get the alphanumeric sender "The Alliance" (`server/src/mms/mms.service.ts`).
- The webhook counts a text as STOP or START only when the whole text, trimmed and uppercased, is one of STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, OPTOUT or START, YES, UNSTOP (`mms.controller.ts`), so "OPT OUT" and "Stop." are logged as unhandled texts.
- The only outbound text that names STOP is the opt-in welcome message (`server/src/notifs/textnotifcontents.ts`); staff texts carry no opt-out disclosure.
- Seven callers send through `MmsService.sendMms`, which checks no opt-out itself. Six check it on the user they loaded, through `externalChannels`, `textReachable` or `channelsFor`; the opt-in welcome (`tasks/form-profile-answers.service.ts`) checks none, and Twilio's block list refuses it to a number that sent STOP. `notifs/test-users.ts` sets the flag only as a fixture default.
- Login codes (`server/src/otp/otp.service.ts`) and KORA review notices to participants with no email (`server/src/kora/kora-notify.service.ts` `contact`), whose numbers may belong to no member, are sent through `sendUnrecordedText`, which checks no opt-out.
- Production doesn't delete or anonymise texts on account deletion; `scripts/anonymize/anonymize.sql` runs on staging copies, and rewrites every `mms` number that belongs to no member to the one placeholder `+15550000000`, and every `mms_optout` number to its user's placeholder, `+1555` followed by the user id zero-padded to seven digits, whatever number the row held.

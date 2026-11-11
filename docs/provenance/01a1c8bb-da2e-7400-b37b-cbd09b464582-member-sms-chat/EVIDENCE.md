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

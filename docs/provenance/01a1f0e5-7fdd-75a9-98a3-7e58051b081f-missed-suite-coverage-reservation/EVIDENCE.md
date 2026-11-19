# Evidence

Checked 2026-11-18. No source found addresses one message type suppressing a different one; the findings below cover the two neighbouring rules.

## Overlapping messages

Question: should a notice to a member hold back a second notification about the same tasks?

- Apple Human Interface Guidelines (vendor recommendation): "Avoid sending multiple notifications for the same thing, even if someone hasn't responded." https://developer.apple.com/design/human-interface-guidelines/notifications
- Braze (vendor recommendation): frequency caps limit messages per user per day, across or per channel. A volume cap, not detection of two messages about the same thing. https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping
- Customer.io (vendor recommendation): per-person limits, optionally shared across channels; a message over the limit is marked undeliverable or retried later. https://docs.customer.io/messaging/send/message-limits/overview/

## Counting an unconfirmed send as sent

Question: while a send's outcome is unknown, does it count as taken, and for how long?

- IETF Idempotency-Key header draft (Internet-Draft -08, work in progress, not a standard): a retry arriving while the original request is still processing "SHOULD" get HTTP 409 Conflict, so an in-progress request counts as taken. It covers retries of the same operation. https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
- OneSignal (vendor recommendation): a notification's `idempotency_key` is kept for 30 days; a retry with the same key returns the original result instead of sending again. https://documentation.onesignal.com/reference/idempotent-notification-requests
- Lettermint (vendor recommendation): returns 409 while a request with the same key is in progress. https://lettermint.co/docs/platform/emails/idempotency
- KodeKloud system-design course notes (common practice, weak source): claim a send atomically with set-if-not-exists and a TTL before making it, then release with compare-and-delete. https://notes.kodekloud.com/docs/System-Design-for-Interview-Prep/Fan-Out-One-Event-Many-Readers/Notification-System-The-Duplicate-Trap/page

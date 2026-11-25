# Evidence

## 1. How support tools record closing and reopening a conversation

Question: do established support tools keep only a conversation's current state, or a history of each close and reopen? Checked 2026-11-16 from the vendors' API documentation; each is a vendor recommendation for its own product, and together they are common practice, not a formal standard. Read through search-result summaries of these pages, not every page in full.

- **Intercom** records close, open, snooze and assign as conversation parts in the conversation, each with a `part_type` such as `close` or `open`. Vendor documentation. [Manage a conversation](https://developers.intercom.com/docs/references/2.13/rest-api/api.intercom.io/conversations/manageconversation), [conversation part](https://developers.intercom.com/docs/references/2.13/rest-api/api.intercom.io/models/conversation_part)
- **Zendesk** keeps ticket audits, a read-only history of every update, whose change events give each property's previous and new value, status included. Vendor documentation. [Ticket audits](https://developer.zendesk.com/rest_api/docs/support/ticket_audits), [Ticket audit events reference](https://developer.zendesk.com/documentation/ticketing/reference-guides/ticket-audit-events-reference/)
- **Front** lists a conversation's events, among them `archive` and `reopen`, and reopens a conversation when a new inbound message arrives. The full list of event types was not confirmed. Vendor documentation. [Events](https://dev.frontapp.com/reference/events), [Reopened conversations](https://help.front.com/en/articles/2063)
- **Help Scout** records a status change or assignment as a `lineitem` thread in the conversation, with a readable description of the action. Vendor documentation. [List threads](https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/list)

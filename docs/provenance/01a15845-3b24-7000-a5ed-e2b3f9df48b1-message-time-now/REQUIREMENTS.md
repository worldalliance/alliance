---
user: Charles Lien
task: Deduplicate the "now" rule for message timestamps
---

## User-origin requirements

- Deduplicate code by its likely future changes, so each rule has a single source of truth and its copies cannot diverge, not by how many lines it removes.
- Deduplicate with judgment for good coding practice, not blindly.
- Each deduplicated item is a standalone commit.

## Origin unclear

- The item: the web message header (`apps/frontend/src/components/Message.tsx`), the mobile message bubble (`apps/mobile/components/messages/MessageBubble.tsx`) and the mobile conversation list row (`apps/mobile/components/messages/ConversationListItem.tsx`) each show a message's relative time with "now" in place of "less than a minute ago". They share one formatter with unit tests.

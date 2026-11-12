# Evidence

## Experiments

### Who consumes the one-shot `findOne` mock

2026-11-10, bun 1.4.4, branch off `origin/main` at `c10c390fb5`. A temporary 200 ms delay at the start of `MessagingOverviewGateway.emitUnread`, and a stack trace logged inside the test's `findOne` mock. Without the fix, the mock ran from `countUnreadForConversation` (`conversation-unread.service.ts:45`) via `buildConversationDto`, not from `placeCommunityConversationParticipant`. With the fix, `emitUnread` never ran and the mock ran from `placeCommunityConversationParticipant` (`community-conversation.service.ts:219`). The exact CI interleaving, where the stray deletion lands after the placement's update, was not reproduced locally: with the delays tried, the stray deletion landed before the placement's load, and the test passed.

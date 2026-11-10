# Decisions

## Test race, not product race

ALL-2116 listed two candidate causes. The cause is the test race (agent decision, from the experiment in `EVIDENCE.md`). `updateLive` writes only where `"deletedAt" IS NULL`, so the placement cannot set `joined` on a row already deleted. A row that is both `joined` and deleted means the deletion landed after the write. That happens when something other than the placement consumes the one-shot `findOne` mock, then deletes the row after the placement has updated it.

The consumer is `MessagingOverviewGateway`. `syncCommunityConversationMembers` in `setUp` emits `ConversationUpdated`, and the gateway answers with detached `emitUnread` work that reaches `participantRepository.findOne` through `ConversationService.getConversationForUser` → `ConversationUnreadService.countUnreadForConversation`. Nest's injected `Repository<Participant>` is the same instance as `dataSource.manager.getRepository(Participant)`, which the test spies on.

## Mute the event emitter for the whole file

A `beforeEach` in `live-row-updates-messaging.e2e-spec.ts` stubs `EventEmitter2.emit` (agent decision). The same detached work also calls `ConversationService.getParticipantOrFail` and `Conversation` `findOneOrFail`, which the file's other one-shot mocks spy on, so those tests are exposed the same way. The file asserts only database state, never events. The alternatives each fix one test: narrowing each mock to its caller's arguments, or passing the placement a separate `EntityManager`.

---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by the coordinating agent

- Target: the conversation info writes `conversationAddParticipant`, `conversationRemoveParticipant`, `conversationLeave`, and `conversationUpdateInfo`, called directly from `apps/frontend/src/components/ConversationInfoPanel.tsx` and `apps/mobile/app/(app)/messages/[conversationId]/info.tsx`.

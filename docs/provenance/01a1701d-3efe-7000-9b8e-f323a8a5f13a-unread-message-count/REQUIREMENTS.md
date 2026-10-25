---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Agent-selected target (not user-approved)

- Target: the unread messages count behind the web navbar's and mobile tab bar's Messages badge. `useMessagingUnread` in `shared/lib/messages.ts` kept it in component state, fetched with a raw `conversationGetUnreadSummary` call and refreshed from the overview socket's `conversation:unread` event; the same file also called `conversationMarkRead` raw. The count moves into a named hook that owns its query cache and the events that refresh it, at parity on web and mobile.

---
user: Charles Lien
task: Move one piece of server state that bypasses react-query into a named TanStack Query hook
---

## User-origin requirements

- Everything that touches a query cache lives in a single named hook. That hook may call several endpoints that share the cache.
- Find code that should go through a named TanStack Query hook but doesn't: a generated `sdk.gen.ts` function called outside react-query, or a raw `useQuery` in a component outside a named hook. Complete one such hook.
- The changes go in standalone commits.

## Assigned target (coordinating agent, not the user)

- Leaving a group (`communityLeave`) and joining a public group (`communityJoinPublicCommunity`) from the member's groups list, on web (`apps/frontend/src/components/myGroups/`) and mobile (`apps/mobile/components/groups/`). Those sections call the generated client directly and refresh the lists by hand.

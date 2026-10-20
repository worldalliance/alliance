---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Agent-selected target (not user-approved)

- Target: `useMyCommunities`, which owns the signed-in member's groups under `queryKeys.myCommunities()`. Saving a group's settings (web and mobile), deleting a group (web), and removing a member (web) each call the client directly and then patch that cache through setters the hook exposes. Each moves into the hook.

---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by a coordinating agent (not user-approved)

- Target: the admin stats page's missed actions card (`apps/admin/src/components/stats/MissedActionsCard.tsx`), which loads `analyticsGetMissedActionsAdmin` into local state behind a TODO `api-client/named-hooks-only` lint disable.

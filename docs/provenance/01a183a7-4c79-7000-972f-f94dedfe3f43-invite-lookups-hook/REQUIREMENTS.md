---
user: Charles Lien
task: Move code that touches a TanStack Query cache from outside the named hook that owns it into that hook
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `InviteSessionProvider` in `apps/frontend/src/site/invite/InviteSession.tsx` removes the cached `referrerProfile` and `onetimeInvite` lookups for the tab's invitation code with `queryClient.removeQueries` when the visitor forgets or dismisses it. `useInvite` in `shared/lib/useInvite.ts` owns those two queries. The removal moves into `useInvite`, keeping when it happens and which lookups it drops.

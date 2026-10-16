---
user: Charles Lien
task: Admin stats page loads contract status history through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Find code that should be using a named TanStack Query hook but isn't (an `sdk.gen.ts` function called without TanStack, or a raw `useQuery` in a component), and complete one hook, which shares one query cache and may cover several endpoints. The changes go in standalone commits.

Origin: orchestrating agent (not the user)

The target area is the admin stats page's direct analytics loads (`analyticsGet*Admin` calls in `apps/admin/src/pages/StatsPage.tsx`); migrate one hook's worth and leave the rest. In `shared/lib/queryKeys.ts`, add keys in place without reordering or reformatting other entries.

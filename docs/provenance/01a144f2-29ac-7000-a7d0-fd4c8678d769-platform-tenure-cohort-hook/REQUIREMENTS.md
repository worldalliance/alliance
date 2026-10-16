---
user: Charles Lien
task: Admin stats page loads the platform tenure cohort through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Find code that should be using a named TanStack Query hook but isn't (an `sdk.gen.ts` function called without TanStack, or a raw `useQuery` in a component), and complete one hook, which shares one query cache and may cover several endpoints. The changes go in standalone commits.

Origin: coordinating-agent-assigned

The target area is admin analytics on the stats page (`apps/admin/src/pages/StatsPage.tsx`); look for the hook to complete only there.

---
user: Charles Lien
task: Load the admin StatsPage invite funnel through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Code that calls an `sdk.gen.ts` function outside TanStack Query, or a raw `useQuery` in a component, moves into one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: coordinating agent's assignment

The hook to complete is the admin `StatsPage` invite funnel (`analyticsGetInviteFunnelAdmin`), loaded until now by a `useCallback`/`useEffect` pair into local state. Only the invite funnel in `StatsPage` changes.

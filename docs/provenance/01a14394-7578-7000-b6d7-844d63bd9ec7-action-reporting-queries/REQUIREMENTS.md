---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by the coordinating agent

- Target: the admin action dashboard's reporting loads in `apps/admin/src/pages/action-dashboard/useActionReporting.ts`: incomplete users (`actionsGetIncompleteUsersAdmin`), share URL stats (`actionsShareUrlStatsAdmin`), the task form and its responses (`tasksGetForm`, `tasksGetFormResponsesAdmin`), and action stats (`analyticsGetActionStatsByIdAdmin`). Linear ALL-1662, a stale response overwriting the current action's stats, is related.

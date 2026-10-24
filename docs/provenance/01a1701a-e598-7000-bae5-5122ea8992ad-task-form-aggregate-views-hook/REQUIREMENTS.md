---
user: Charles Lien
task: Load a task form's aggregate views through one named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Code that calls an `sdk.gen.ts` function outside TanStack Query, or a raw `useQuery` in a component, moves into one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: agent-proposed

The hook to complete is a task form's aggregate views (`tasksGetFormAggregateViews`), loaded until now by two hand-rolled frontend fetchers: `useLiveTaskFormAggregateViews` on the action page (`ActionContents`) and `fetchTaskFormProgressViewsByFormId` behind the home page sidebar's progress bars (`useSidebarProgressBarEntries`). Both read one cache entry per form id, and the views refresh by invalidation from the writes that change them rather than by subscribing to the query cache.

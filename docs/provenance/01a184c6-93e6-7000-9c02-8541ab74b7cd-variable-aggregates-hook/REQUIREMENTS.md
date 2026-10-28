---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `useVariableAggregates` in `shared/forms/` loads an open form's aggregate counts from `tasksGetVariableAggregates` or `tasksCountVariableAggregatesAdmin` into `useState` through a `useEffect`, with a hand-rolled attempt counter for retry, outside any query cache. The counts move into one TanStack query owned by the hook, keeping what web and mobile forms and admin previews show while the counts load, once they load, and when they fail.

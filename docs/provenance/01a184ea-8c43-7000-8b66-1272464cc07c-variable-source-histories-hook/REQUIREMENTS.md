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

- `useVariableSourceHistories` in `shared/forms/` loads the submitted answers an open form's variables and options formulas read from other forms, from `tasksGetMyFormResponseHistory` or `tasksGetMemberFormResponseHistoryAdmin`, into `useState` through a `useEffect`, with hand-rolled retry and reload, outside any query cache. The histories move into TanStack queries owned by the hook, keeping what web and mobile forms and admin previews show while the histories load, once they load, when they fail, and when a source form is deleted.

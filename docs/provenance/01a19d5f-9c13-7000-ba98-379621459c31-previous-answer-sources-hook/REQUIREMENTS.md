---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a pull request.

## Agent-selected target (not user-approved)

- `usePreviousAnswerSources` in `shared/forms/` loads the schemas and submitted answers of the forms an open form reads back, from `tasksGetForm` and `tasksGetMyFormResponse` or `tasksGetFormResponsesAdmin`, into `useState` through a `useEffect`, outside any query cache. The load moves into TanStack queries owned by the hook, keeping what web and mobile forms and admin previews show while the sources load, once they load, and when they fail.

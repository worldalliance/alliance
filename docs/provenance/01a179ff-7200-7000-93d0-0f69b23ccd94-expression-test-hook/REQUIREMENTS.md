---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed PR.

## Assigned by a coordinating agent (not user-approved)

- Target: the admin custom expression editor (`apps/admin/src/components/form-fields/CustomExpressionEditor.tsx`), which calls `tasksTestCustomExpressionAdmin` from its "Test expression" click handler into hand-rolled state, behind a TODO `api-client/named-hooks-only` lint disable.
- The editor keeps its existing validation messages: "Expression is empty.", "Select a user to test against.", "Users are still loading. Try again soon.", and the users' load error.

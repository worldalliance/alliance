---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- If the chosen code turns out not to touch data a query cache should own, or the data is already owned properly, stop before changing anything and report why.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- The admin's stored form by id, cached under `queryKeys.taskFormAdmin(formId)` by `adminTaskFormQuery` in `shared/lib/useTaskForm.ts`. The form builder's load (`apps/admin/src/lib/useSavedForm.ts`), its save and conflict reload (`apps/admin/src/lib/useFormSave.ts`) and the action dashboard's duplicate (`apps/admin/src/pages/action-dashboard/useActionCommands.ts`) call `tasksGetFormAdmin` and `tasksUpdateFormAdmin` themselves, outside that cache. They move behind the owner, keeping the builder's load-once editing, its conflict handling and its messages.

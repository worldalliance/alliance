---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Investigate first: if the target doesn't touch data a query cache should own, or a cache already owns it properly, stop before changing anything.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `useFormDraftSync` in `shared/forms/`, used by the web and mobile form renderers through their `useFormDraftState`, calls `tasksGetFormDraft` and `tasksSaveFormDraft` directly, holding the member's server-side form draft in component state. Both requests move into TanStack Query in the same hook, keeping the autosave: a save 1.5 seconds after the last edit, no save until the stored draft has been read successfully, and no save while a submission or withdrawal is in flight.

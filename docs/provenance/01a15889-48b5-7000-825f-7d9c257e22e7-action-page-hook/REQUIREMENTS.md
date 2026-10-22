---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by a coordinating agent (not user-approved)

- Target: the action detail page. `useActionHandlers` (`shared/lib/actionPage.ts`), used by web's `ActionPage` and mobile's action detail screen, calls `actionsFindOne` directly and keeps the action in component state, while `useAction` (`shared/lib/useAction.ts`) already owns that endpoint's cache. `ActionPage`'s route loader also calls `actionsFindOne` and `actionsGetSharePreview`. Task form submissions, opt-outs and follow-up forms are out of scope.

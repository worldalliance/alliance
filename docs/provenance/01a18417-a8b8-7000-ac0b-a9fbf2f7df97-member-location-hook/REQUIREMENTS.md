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

- The signed-in member's stored city, from `GET /user/mylocation` (`userMyLocation`). `useCurrentUserLocation` in `shared/forms/` loads it into `useState` for a form's `userLocation` display block, and `useSeedSettingsForm` in `shared/lib/` loads it again into each settings page's own `useState`, both calling the client directly outside any query cache. The writes that change it (a settings save that sets `cityId`, and a member's task-form submission whose answers set their city) refresh nothing. The location moves into one TanStack query that every reader goes through and every such write refreshes, keeping what each screen shows: the stored city, falling back to the member's custom city text.

---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Assigned by a coordinating agent (not user-approved)

- Target: `shared/forms/cityAutosuggest.ts`, shared by web (`sharedweb/forms/CityAutosuggest.tsx`) and mobile (`apps/mobile/components/forms/CityAutosuggest.tsx`), calls `geoSearchCity` from a plain async function used by `useCityAutosuggest`, behind a TODO `api-client/named-hooks-only` lint disable. The request moves into a TanStack query keyed by the search text, keeping the existing debounce, minimum length, and stale-response behavior.

---
user: Charles Lien
task: Move code that touches a TanStack Query cache from outside the named hook that owns it into that hook
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `shared/lib/useHomeFeed.tsx` exports `resetHomeFeed(queryClient)`, and its callers fetch the query client themselves to reset the home feed's cache: the web home page (`apps/frontend/src/pages/app/HomePage.tsx`) when a member completes an action, the mobile home screen (`apps/mobile/app/(app)/index.tsx`) when the success overlay fades in, and `useTaskFormSubmission` after a follow-up form submits. The reset moves behind a named hook in `useHomeFeed.tsx`, keeping when it happens and that it resets rather than invalidates.

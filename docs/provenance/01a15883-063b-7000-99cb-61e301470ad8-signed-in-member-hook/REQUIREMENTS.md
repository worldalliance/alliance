---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by a coordinating agent (not user-approved)

- Target: the signed-in member. `apps/frontend/src/lib/AuthContext.tsx`, `apps/frontend/src/onboarding/OnboardingPage.tsx` and `apps/mobile/lib/refreshUser.ts` call `authMe` directly, while `shared/lib/meQuery.ts` already caches the same member under a TanStack query.
- In scope: the `authMe` reads and whatever writes that member's cache. Login, logout, token refresh, registration, password reset and contract signing stay as they are unless the cache demands otherwise.

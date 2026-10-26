---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by a coordinating agent (not user-approved)

- Target: `apps/admin/src/components/DeleteAccountModal.tsx`, which deletes a member through `userDeleteUserAdmin` directly, under a TODO `api-client/named-hooks-only` lint disable, and refreshes no cached data afterwards. Find which cached admin data a deletion changes, such as the users list behind `apps/admin/src/lib/useUsersAdmin.ts`. Its `imagesUploadImage` call is a file upload whose result nothing caches.

---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.

## Assigned by a coordinating agent (not user-approved)

- Target: the direct generated-client calls in the admin member page (`apps/admin/src/pages/UserDetailView.tsx`), whose `clientLoader` calls `notifsNotifsForUserAdmin`, `tasksGetFormsForUserSidAdmin` and `userFriendListFriends` directly and passes their results down as loader data. Move one cohesive group that shares a cache behind a named hook; the rest stay for later.

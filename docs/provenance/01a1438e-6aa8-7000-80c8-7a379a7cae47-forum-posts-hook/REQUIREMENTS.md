---
user: Charles Lien
task: Load the forum post list through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Code that calls an `sdk.gen.ts` function outside TanStack Query, or a raw `useQuery` in a component, moves into one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: orchestrating agent's assignment, not the user

The hook to complete is the forum post list (`forumFindAllPosts`), fetched by mobile `apps/mobile/app/(app)/forum/index.tsx` in a `useEffect` and by web `apps/frontend/src/pages/app/ForumPage.tsx` in a route loader: one hook shared by both platforms, if that holds up.

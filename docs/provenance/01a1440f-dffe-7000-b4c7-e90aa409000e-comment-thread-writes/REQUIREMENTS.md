---
user: Charles Lien
task: Move forum comment writes into a named TanStack hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Code that calls an `sdk.gen.ts` function outside TanStack Query, or a raw `useQuery` in a component, moves into one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: orchestrating agent's assignment, not the user

The area is forum comment writes: web `apps/frontend/src/components/forum/CommentsContext.tsx` calls `forumCreateComment`, `forumUpdateComment` and `forumPinCommentAdmin` itself and patches the thread by hand; mobile `apps/mobile/components/Comments.tsx` does the same with `forumCreateComment` and `forumUpdateComment`. Web and mobile share the result.

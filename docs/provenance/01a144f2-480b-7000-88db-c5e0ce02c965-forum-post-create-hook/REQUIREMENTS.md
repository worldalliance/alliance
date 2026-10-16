---
user: Charles Lien
task: Create forum posts through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Find code that should go through a named TanStack hook but doesn't, such as an `sdk.gen.ts` function called outside TanStack Query or a raw `useQuery` in a component, and complete one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: coordinating-agent-assigned

The area is creating forum posts: mobile `apps/mobile/app/(app)/forum/create.tsx` and its web counterpart, `apps/frontend/src/pages/app/PostFormPage.tsx`.

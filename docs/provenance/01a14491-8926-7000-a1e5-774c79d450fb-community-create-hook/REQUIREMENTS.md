---
user: Charles Lien
task: Create groups through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Find code that should go through a named TanStack hook but doesn't, such as an `sdk.gen.ts` function called outside TanStack Query or a raw `useQuery` in a component, and complete one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: agent-selected area, within the user's request

The area is member-facing group creation: web `CommunityCreateForm` and mobile `groups/manage.tsx`, `InviteForm.tsx` and `InviteShareLink.tsx` call `communityCreateCommunity` directly, then refresh the user's groups by hand. Web and mobile share the result.

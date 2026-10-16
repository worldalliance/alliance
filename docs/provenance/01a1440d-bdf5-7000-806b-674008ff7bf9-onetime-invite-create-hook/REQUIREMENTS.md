---
user: Charles Lien
task: Create one-time invites through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Code that calls an `sdk.gen.ts` function outside TanStack Query, or a raw `useQuery` in a component, moves into one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: orchestrating agent's assignment, not the user

The area to work in is member-facing one-time invites: web and mobile `InviteForm` call `userCreateOnetimeInvite` directly, and the mobile group invites tab calls `userGetOnetimeInvitesByCommunity` directly. Pick the cohesive slice that shares one cache, on web and mobile alike. Leave the admin one-time invite hooks, `communityCreateCommunity` and `communityUpdate` alone.

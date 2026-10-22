---
user: Charles Lien
task: Load and write the admin group-assignment queue through a named TanStack Query hook
---

Origin: user

Everything that touches a query's cache lives in a single named hook. Find code that should go through a named TanStack hook but doesn't, such as an `sdk.gen.ts` function called outside TanStack Query or a raw `useQuery` in a component, and complete one such hook (one shared query cache, possibly several endpoints). Land the change as standalone commits.

Origin: coordinating-agent-assigned

The area is the admin staff group-assignment queue: `apps/admin/src/lib/GroupAssignmentContext.tsx` and what reads that cache. It loads the members waiting for staff group assignment with a raw `userGroupAssignmentGetGroupAssignmentMembersAdmin` call into React state, and `GroupAssignmentPanel` removes assigned members from that state by hand.

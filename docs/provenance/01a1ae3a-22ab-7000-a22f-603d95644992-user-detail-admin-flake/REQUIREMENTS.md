---
user: Charles Lien
task: Fix ALL-1938, the flaky test `apps/admin/src/lib/useUserDetailAdmin.test.ts` › "settles a tag change only once the refetch that replaced its own lands", and open a PR for it.
---

# Requirements

- The test no longer depends on timing: it controls each member detail response deterministically (for example by holding it on a deferred promise) or waits on query state, and keeps what it asserts. (user-originated)
- If `useUserDetailAdmin` itself is wrong, fix the hook and say so. (user-originated)
- Show the flake is gone by running the file many times (around 50), alone and while the machine runs another test run in parallel, with before and after counts in the PR description. If the flake can't be reproduced before the fix, say so plainly. (user-originated)

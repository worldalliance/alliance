---
user: Charles Lien
task: Membership agreement page shares one definition of its rules between web and mobile
---

Origin: user

Find duplicated code and deduplicate one item, using judgment rather than line counts: group code by its likely future changes, so each rule has a single source of truth and the copies cannot diverge. The changes go in standalone commits.

Origin: orchestrating agent (not the user), approved by the user

The item is the membership agreement section of the web page `apps/frontend/src/pages/app/MembershipPage.tsx` and the mobile screen `apps/mobile/app/(app)/membership.tsx`. Each defines its own copy of these rules; move them into `shared/` so both apps use one definition:

- The confirmation statement a member types to sign ("I commit to complete each task to the best of my ability.") and the check of the typed text against it.
- The derived status: whether the latest contract is signed, which previously signed contract to show, and when to tell the member that an updated contract is available.
- The signed event the page records locally after signing.
- When the sign button is enabled.

Where web and mobile disagree, pick the correct behaviour and explain the choice in the PR.

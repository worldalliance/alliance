---
user: Charles Lien
task: One rule for whether an actor may manage a group's invites and invite requests
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge; copies that would legitimately evolve independently stay separate. (user-originated)
- One policy decides whether an actor may manage a group's invites and invite requests, and every check of it routes through one helper, `canManageCommunity` in `server/src/user/entities/user.entity.ts` (an admin, or a leader of that group). (agent-proposed, user-approved)
- The leader-only re-implementations are re-examined: share-link group targeting (`assertLeadsCommunity` in `share-urls.service.ts`), answering a community invite request (`community.service.ts`), and answering a one-time invite request (`user.service.ts`). Each is checked for whether excluding admins was deliberate before changing it; where it was, it stays and the reason is recorded. (agent-proposed)
- Editing and deleting a one-time invite agree on who may do it. (agent-proposed, user-approved)
- Removing a member (`removeUserFromCommunity`) and deleting a group (`deleteCommunity`) stay leader-only, after confirming that their separate admin variants make this intentional. (agent-proposed)
- The policy and each per-site decision are recorded in the pull request. (agent-proposed)
- Every changed endpoint gets an end-to-end test of its admin path; each behavior change has a test that would catch a regression. (agent-proposed)
- Minimal standalone commits: one purpose each, each typechecks and passes tests on its own. (user-originated)

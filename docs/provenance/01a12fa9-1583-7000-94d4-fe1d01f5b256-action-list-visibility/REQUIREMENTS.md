---
user: Charles Lien
task: One rule for whether an action appears in a member's action lists, applied to global search
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. Copies that would legitimately evolve independently stay separate. (user-originated)
- Every decision of whether a given user may see an action in a list goes through one server function, so a new hiding rule cannot be missed by one list. (agent-proposed, user-approved)
- Global search (`GET /search/all`) returns only the actions the requesting user's action feed would list: no archived actions, no public-only actions, and no cohort-restricted actions outside the user's cohort. (agent-proposed, user-approved)
- Tests cover search leaving out archived, public-only, and out-of-cohort actions. (agent-proposed, user-approved)
- One standalone commit. (user-originated)

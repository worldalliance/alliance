---
user: markzxu
task: Make the expected-members count on an action's page correct the moment the action launches.
---

# Requirements

- The expected-members count (the denominator of "N / M members completed" on an action's page, `Action.usersJoined`) is correct from the moment the action launches, rather than counting only the members the cohort decision pass has decided so far. (user-originated)
- At launch, a member the pass has not decided yet counts if the action's cohort rule includes them now. (agent-proposed, user-approved)
- Only the count changes; the admin status tables, the incomplete-member list and action update notifications keep reading saved decisions. (agent-proposed, user-approved)

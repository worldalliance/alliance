---
user: Alex Dorey
task: Restrict the "All members" action-update audience to users with an active contract
---

## User-origin requirements

- An action update whose audience is "All members" (`ActionUpdateNotifyType.AllMembers`) reaches only users who hold an active contract when the audience is resolved. Users who never signed a contract and users whose contract is suspended receive nothing.
- A test reproducing the current behavior, where unsigned and suspended users are in the audience, is written first and fails before the fix.

---
user: Charles Lien
task: Start ALL-2148 (Ratchet: no new form conditions on SwitchedDomainAt) on the `domain` branch, and open its PR once finished.
---

# Remove the SwitchedDomainAt form condition property

- Instead of the ALL-2148 ratchet followed by the ALL-2149 migration, one PR removes `SwitchedDomainAt` from the user properties form conditions can use (`UserValueProperty`) and from the presence values the server sends for evaluating them (`userPropertyHasValue` in `GET /user/myvisibilitycontext`). ALL-2149 closes with nothing to migrate. (agent-proposed, user-approved)
- The `switchedDomainAt` user column and its `UserDto` field stay; removing them is ALL-2150. (agent-proposed, user-approved)
- The work is done on the `domain` branch, reset to `origin/main`. (user-originated)

---
user: Alex Dorey
task: Fix the 500 from pasting an action's JSON into the admin when its taskFormId already belongs to another action in the target environment.
---

- Pasting an action's JSON ignores the pasted `taskFormId`: the pasted action gets a copy of the pasted `taskForm` when there is one, and no form otherwise. (agent-proposed, user-approved)

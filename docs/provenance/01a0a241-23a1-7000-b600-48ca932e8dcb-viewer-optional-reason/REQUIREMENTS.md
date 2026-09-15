---
user: Charles Lien
task: Send the reason an action is optional for one viewer on the wire
---

- A review of the "optional for you" copy commit (agent-written) found that the client inferred why `viewer.optional` was widened from `viewer.optional && !action.optional` and named that reason ("You weren't a member for all of this task") in copy. Once a mobile build ships, the server could never widen the flag for a second reason without installed apps showing the wrong reason.
- The agent offered three fixes: drop the reason from the copy, send the reason on the wire now, or skip. The user chose sending the reason on the wire, as a commit placed before the copy commit.

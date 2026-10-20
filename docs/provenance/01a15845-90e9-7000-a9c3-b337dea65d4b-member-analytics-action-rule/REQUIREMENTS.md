---
user: Charles Lien
task: Decide which actions count toward member analytics in one place
---

- Deduplicate one item, grouping code by its likely future changes so there is a single source of truth and behavior cannot diverge, rather than by how many lines it deletes. Put it in a standalone commit. (user)
- Use judgment and good coding practice rather than unifying blindly. (user)
- The item: the member analytics services (missed actions, completion retention, platform tenure, the action stats chart) each decide which actions to exclude. Unify the shared rule only; choices that differ per metric stay visible where each metric makes them. (agent-proposed item; the user asked for the deduplication)

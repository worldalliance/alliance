---
user: Charles Lien
task: Fix a Linear bug the agent judges easy, choosing among the high-priority ALL-1238, ALL-1242 and ALL-1222.
---

# Requirements

- Pick a Linear bug that is easy to fix. The user named ALL-1238, ALL-1242 and ALL-1222 as high priority.
- Fix it in minimal standalone commits on the `bugs` branch.

The agent chose ALL-1242. What the issue asks for, as filed (agent-authored, `AI-generated`):

- Deleting an action that another action's cohort expression names through an `InProgressAction` or `MissedActionDeadline` leaf succeeds silently, and that cohort then matches nobody (or everybody under `NOT`).
- Suggested fix: alongside `assertNotAPrerequisite`, reject the delete while a stored cohort expression names the action, listing the referring actions in the error. The issue leaves open whether `CompletedAction` leaves and follow-up forms' cohort expressions should block too.

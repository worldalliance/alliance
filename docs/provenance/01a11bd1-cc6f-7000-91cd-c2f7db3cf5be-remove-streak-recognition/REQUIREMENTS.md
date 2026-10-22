---
user: Charles Lien
task: Specify complete removal of streak-recognition reminders from PR 477
---

## User-origin requirements

- Revert the feature introduced in PR #477, commit `63070b1de9aab24f76dcc00149e854322f0b0388`.
- Remove the feature completely, including its database fields.
- Use the spec interview workflow. Implementation has not been requested.

## Approved agent proposals

- The agent proposed restoring pre-PR reminder behavior and admin controls, undoing the supporting refactors, and adding a reversal migration while preserving the original migration history. The user selected complete removal.
- The agent recommended checking immediately before cleanup for enabled streak reminders, streak experiment assignments, or streak notification records, and pausing cleanup if any appear so their treatment can be decided. The user accepted that recommendation.
- The agent proposed a brief, automatically managed backend interruption during deployment so the removal can follow the normal merge flow without manual SSH or SQL steps. The user accepted that interruption.

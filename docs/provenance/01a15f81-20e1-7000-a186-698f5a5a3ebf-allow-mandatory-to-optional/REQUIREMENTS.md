---
user: markzxu
task: Allow an action's `optional` flag to change from mandatory to optional after members already have cohort decisions for it
---

# Requirements

- An action's `optional` field can be changed from `false` (mandatory) to `true` (optional) through `PATCH /actions/:id`, even when the action already has saved `ActionCohortDecision` rows. (user-originated)
- Changing `optional` from `true` (optional) to `false` (mandatory) must stay blocked with a 400 `BadRequestException` once the action has saved `ActionCohortDecision` rows, exactly as today. (user-originated, carried over from existing behavior)
- The error message shown when the still-blocked direction is attempted should continue to explain why, updated to reflect that only the mandatory-to-optional direction is now allowed.

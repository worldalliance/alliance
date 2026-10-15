---
user: Alex Dorey
task: Split an action update's collective result by member group, add a live Preview Update section to the action update creator, remove the action_update_recognition experiment, and send each group's result as the admin wrote it, with no per-member templating
---

## User-origin requirements

### Split by group

- An action update's "Collective result" gets a checkbox that splits it into three groups, each with its own text:
  - members who completed the action,
  - members who didn't complete the action,
  - members who were away or not involved.
- The checkbox and the group fields appear both in the new-update dialog (the action's Updates tab) and on the action update editor page.

### Preview Update

- A "Preview Update" section sits at the bottom of the action update creator, on both the new-update dialog and the editor page.
- It lists every variation of the update that will go out and shows how recipients will see each one.
- It updates on every text change, so the admin can review while typing.
- It shows one count for completers, with no breakdown into personal, collective, or undrawn completers.

### Copy as written

- The admin writes each update's text directly. There is no "Your #{contribution} led to …" template and no per-member contribution.
- No experiment arm is drawn or read when an update's copy is frozen or sent.
- Legacy mode stays for the 43 existing updates that use it.
- `ActionUpdateExposure.assignedArm` is removed, and so are `Experiment.ActionUpdateRecognition` and its `experiment_assignment` rows, if nothing else reads them.
- No action update has gone out since branching rolled out, so no exposure rows exist and no history needs preserving.

## Agent-proposed, user-approved selections

### Copy as written

- Each group gets its text exactly as written. Contribution formulas, the "Your … led to" wording, and the retrospective "N weeks ago you …" wording are removed. Only the greeting's first name and the link vary per member.
- The normal/retrospective mode picker is removed. `ActionUpdateNotificationMode` keeps only legacy and one recognition mode (`normal`), and existing retrospective updates move to it.
- Every recipient's push and text lead with "Update: ", as the collective-result copy already did.
- The migration drops `contributionFormula`, `retrospectiveContributionFormula`, and the exposure's `mode`, `branch`, `contribution`, and `weeksAgo` columns.
- The migration for the experiment drops the column, deletes the assignment rows, and removes the enum value without checking for existing data first.

### Split by group

- With split on, each group has its own collective result text, sent as written.
- The existing Collective result field holds the completed group's text. Two new fields hold the didn't-complete and away/not-involved texts.
- Group membership:
  - Completed: the member's latest terminal activity on the action is a completion.
  - Didn't complete: the member hasn't completed, is an expected participant on the action's participant roster, and hasn't withdrawn.
  - Away or not involved: the member hasn't completed and isn't an expected participant. That covers not assigned, outside the action's cohort, away during the member-action window, or withdrawn ("won't complete").
- A group whose text is empty gets no notification.
- If all three texts are empty, the send is blocked.
- Each member's group is decided when recognition copy is frozen (`recognitionPreparedAt`), the same moment completion is read.
- Turning split off keeps the two extra texts saved but unused. Turning it back on restores them. With split off, everyone reads the one Collective result.
- Updates in legacy notification mode get neither the checkbox nor the preview.

### Preview Update

- With split on, variations are listed by group: "Completed the action", "Didn't complete the action", and "Away or not involved". With split off, there is one "Everyone" card. A group skipped because its text is empty is listed as not notified.
- The preview has no Branch A/B labels and no note about drawing branches.
- Each variation shows every channel: in-app, push, text message, email subject, and email body.
- Per-member parts appear as visibly highlighted placeholders, not real member data: the recipient's first name and the link.
- The preview's copy matches what sending produces, because the preview and the send run the same copy-building code.
- On the editor page, each variation shows how many members of the current audience fall into it. Counts follow the form's unsaved audience type and tag, and refetch when those change.
- The new-update dialog shows the preview copy without counts.
- Once recognition copy is frozen, the preview is hidden.

## Out of scope

- Agent-proposed, user-approved: storing each member's group on their exposure row.

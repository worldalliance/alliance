---
user: Alex Dorey
task: Split an action update's collective result by member group, add a live Preview Update section to the action update creator, remove the action_update_recognition experiment, and send each group's result as the admin wrote it, with no per-member templating
---

## User-origin requirements

### Two notification texts

- An action update has two notification texts, with no checkbox to turn the split on or off:
  - Notif text for people who completed
  - Notif text for people who didn't complete (includes people away/uninvolved as well as people who failed to complete)
- The two fields appear both in the new-update dialog (the action's Updates tab) and on the action update editor page.

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

### Two notification texts

- `shortNotifString` holds the completed group's text. `nonCompleterResult` holds the didn't-complete text, and away/uninvolved members read that same text.
- Group membership:
  - Completed: the member's latest terminal activity on the action is a completion.
  - Didn't complete: everyone else. That covers expected participants who haven't completed, plus not assigned, outside the action's cohort, away during the member-action window, or withdrawn ("won't complete").
- A group whose text is empty gets no notification.
- If both texts are empty, the send is blocked.
- Each member's group is decided when recognition copy is frozen (`recognitionPreparedAt`), the same moment completion is read.
- Updates in legacy notification mode get neither the two group fields nor the preview.

### Preview Update

- Variations are listed by group: "Completed the action" and "Didn't complete the action". A group skipped because its text is empty is listed as not notified. The didn't-complete card's count includes away/uninvolved members.
- The preview has no Branch A/B labels and no note about drawing branches.
- Each variation shows every channel: in-app, push, text message, email subject, and email body.
- Per-member parts appear as visibly highlighted placeholders, not real member data: the recipient's first name and the link.
- The preview's copy matches what sending produces, because the preview and the send run the same copy-building code.
- On the editor page, each variation shows how many members of the current audience fall into it. Counts follow the form's unsaved audience type and tag, and refetch when those change.
- The new-update dialog shows the preview copy without counts.
- Once recognition copy is frozen, the preview is hidden.

## Out of scope

- Agent-proposed, user-approved: storing each member's group on their exposure row.

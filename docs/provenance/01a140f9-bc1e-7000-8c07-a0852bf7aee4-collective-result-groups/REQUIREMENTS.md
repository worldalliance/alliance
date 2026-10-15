---
user: Alex Dorey
task: Split an action update's collective result by member group, and add a live Preview Update section to the action update creator
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

## Agent-proposed, user-approved selections

### Split by group

- With split on, each group has its own collective result text. Completers in the personal-recognition arm still read their personal line built from the completed group's text: in normal mode "Your #{contribution} led to <completed text>", and in retrospective mode "#{weeksago} weeks ago you #{contribution}. <completed text>". Completers in the collective-only arm read the completed group's text on its own.
- The existing Collective result field holds the completed group's text. Two new fields hold the didn't-complete and away/not-involved texts.
- Group membership:
  - Completed: the member's latest terminal activity on the action is a completion.
  - Didn't complete: the member hasn't completed, is an expected participant on the action's participant roster, and hasn't withdrawn.
  - Away or not involved: the member hasn't completed and isn't an expected participant. That covers not assigned, outside the action's cohort, away during the member-action window, or withdrawn ("won't complete").
- A group whose text is empty gets no notification. An empty completed text skips every completer, including those in the personal-recognition arm.
- If all three texts are empty, the send is blocked, and the recipient check reports the problem.
- Each member's group is decided when recognition copy is frozen (`recognitionPreparedAt`), the same moment completion and contribution are read.
- Turning split off keeps the two extra texts saved but unused. Turning it back on restores them. With split off, behavior is exactly as before: everyone who isn't a personal-recognition completer reads the existing Collective result.
- Updates in legacy notification mode get neither the checkbox nor the preview.

### Preview Update

- Variations are listed by group × recognition side:
  - completed, personal recognition;
  - completed, collective result only;
  - didn't complete;
  - away or not involved.

  With split off, the last three share the one collective result. A group skipped because its text is empty is listed as not notified.

- Each variation shows every channel: in-app, push, text message, email subject, and email body.
- Per-member parts appear as visibly highlighted placeholders, not real member data: the contribution, the weeks-ago lead, the recipient's first name, and the link.
- The preview's copy matches what sending produces, because the preview and the send run the same copy-building code.
- On the editor page, each variation shows how many members of the current audience fall into it. Counts follow the form's unsaved audience type and tag, and refetch when those change.
- Counting never draws experiment arms. Completers whose arm hasn't been drawn yet are counted separately, as completers whose recognition side isn't drawn yet.
- The new-update dialog shows the preview copy without counts.
- Once recognition copy is frozen, the preview is hidden.

## Out of scope

- Agent-proposed, user-approved: storing each member's group on their exposure row.

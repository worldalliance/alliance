---
user: Charles Lien
task: Replace schema groups with local visibility groups in the admin form builder
---

## User requirements

- Delete the existing form-schema groups feature. It is unused; no data content migrations are needed.
- Let admins edit multiple form elements' conditional visibility together through groups.
- Derive groups automatically from consecutive form elements when loading the builder. The absence of a visibility condition must not trigger group creation.
- Let admins split groups to enable different visibility conditions and add an element to a group by changing that element's condition.
- Keep the replacement grouping concept entirely in the local frontend UI. Database content uses the same per-element representation as forms without groups.
- Show an error for invalid visibility dependencies and prevent saving.
- Produce a spec through the interview; implementation awaits a separate request.

## Approvals of agent proposals

The user approved the following agent-authored proposals. Their detailed behavior and rationale are in DECISIONS.md.

- Limit the initial feature to top-level questions and display blocks on input-form pages, treating an accordion as one element; groups stay within one page.
- Compare complete saved visibility structures while ignoring JSON object-key order, without proving logical equivalence.
- Retain manual boundaries through saves, page switches, and previews in the open editing session; rebuild groups on reopening or schema replacement. Splitting alone does not make the form unsaved.
- Provide one shared visibility editor, summary, and member count; offer individual editing by detaching a member.
- Support splitting at any boundary, detaching one element, and ungrouping all members while preserving conditions.
- Join immediate neighboring groups explicitly. Ordinary movement and copying preserve conditions; explicitly adding a new element to a group inherits its condition.
- Preserve boundaries during editing and merge only on explicit request.
- Include adjacent-group merge and collapse/expand. Defer visibility copy/paste and undo; exclude bulk requiredness, group names, and moving or deleting whole groups.
- Allow operations that create invalid dependencies to take effect locally, with an error blocking save; do not block the join or hide a source merely because it is a member of the group.
- Start groups expanded and retain collapse state only for the editing session.
- Clearing a group's condition clears every member and dissolves the group.
- Give groups wrappers only when they have at least two members; a remaining singleton uses ordinary individual editing.
- Detach an element when its JSON editor changes its visibility, splitting the surrounding run; unrelated JSON edits retain membership.
- When merging groups with different conditions, offer either neighboring group's condition with a summary, applying the explicit choice without another confirmation dialog.

---
user: Alex Dorey
task: Pasting an action's JSON from another environment gives its task form the pasted form's own content, not whichever form snapshot has the pasted snapshot id.
---

- Pasting an action's JSON (`POST /actions/pasteJson`) that carries a task form stores that form's content (`taskForm.formSnapshot.schema`) as the new form's snapshot, found or created by content, so the pasted action shows the form that was exported, whatever snapshot ids the target environment has. (user-originated)
- A pasted task form with no snapshot content is refused with an error instead of saving a form that points at an unrelated snapshot. (agent-proposed, user-approved)

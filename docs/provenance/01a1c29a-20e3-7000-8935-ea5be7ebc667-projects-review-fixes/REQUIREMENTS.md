---
user: Alex Dorey
task: Fix `past-deadline-reschedule` and every MEDIUM finding from the review of the projects port (PR 913), on a branch, one commit per fix
---

## User-originated

- Each fix lands in its own commit on a new branch.
- `PATCH actions/:id/release` refuses to move a scheduled release's deadline to a time at or before now, with 400 "The deadline must be in the future".
- Fix these bugs:
  - A project whose action has a future launch but no event in effect yet counts the action as a draft, so `/projects` shows the project under "In the works" with a "draft" chip although the step's pill says "Scheduled".
  - The Release panel says "Notify 0 members" and still allows scheduling when cohort evaluation fails or is still running.
  - Rescheduling an action whose suite has become shared shows the "Move the deadline earlier?" confirmation, because the shared-suite refusal and the deadline-shortening check both answer 409.
  - Creating, updating or deleting a follow-up form leaves the forms index stale, so admin shows the form's old slug until a refetch.
  - The cohort form picker, the list field's source-form picker and the previous-answer block's form picker still label forms `title (#id)` instead of `title (action-slug::form-slug)`, and unlisted forms fall back to "Form #id".
  - A collapsible section of the action details form closes under the cursor when the admin clears the last field that opened it.
  - The inline slug editor drops a failed save's error when it loses focus while the save is pending, and shows the stale error the next time it opens.
  - An action closed (completed, failed or abandoned) without ever launching shows a "Draft" pill.

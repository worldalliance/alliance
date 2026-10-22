# Decisions

- **`CompletedAction` leaves block the delete too.** A deleted action's completions are deleted with it, so a `CompletedAction` leaf naming it matches nobody afterwards: the same silent cohort change the issue describes for the other two leaves.
- **Follow-up forms' cohort expressions count as referrers.** They decide who gets the form the same way an action's expression decides its cohort. The deleted action's own follow-up forms, and its own expression, are deleted with it and don't block.
- **Reject rather than warn.** Matches `assertNotAPrerequisite`, which the admin already sees as an error; the admin removes the leaf and deletes again.
- **No lock against a concurrent write adding a reference.** Writing an expression doesn't check that the actions it names exist, so a write naming an already-deleted action is possible today regardless; the delete check doesn't make that worse.

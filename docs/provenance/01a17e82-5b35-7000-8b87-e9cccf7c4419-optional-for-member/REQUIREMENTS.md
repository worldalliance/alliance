---
user: Alex Dorey
task: Let an action become optional for a member based on their circumstances, and let a member opt out of an action without penalty based on their responses
---

## User-origin requirements

- **Priority.** A member routed into a particular branch of an action must be able to skip that action without consequences. Example: local action 176 ("Help the Alliance prepare for our upcoming democratic grantmaking project") routes members who opted in to the food drive (form 154's field `field-1791935036568` equals `option1`) to its "Donating food" branch. Those members don't need to fill out the survey but may if they want. Members on its "Not donating food" branch are still required to.
- **Nice to have.** A member who reads an action and decides it doesn't fit them has a no-penalty way out, even when none of the existing withdrawal options fits ("Took more than 15 minutes", "Moral objection", the "On vacation" link). The way out can be based on how they answer the action's form.
- A skipped optional action, and either no-penalty opt-out below, must not:
  - count against the member's standing
  - trigger late-decision warnings
  - trigger reminders or missed-deadline notices

## Agent-proposed, user-approved

### Optional branches

- A branch has an "Optional for members on this branch" flag, off by default. Members assigned to a flagged branch are optional for the action. The branch's rule already decides who those members are.
- A branch has an optional-reason text field. When the flag is on and the reason is set, the member sees that reason. When the reason is blank, the member sees the existing generic copy "This action is optional for you."
- Members on a flagged branch see the "Optional" pill and the reason line. Their card sorts below required tasks, and the dismiss button is offered, as for today's contract-gap optional members.
- A member on a flagged branch gets no notifications for the action: no launch notice, no deadline reminders, no missed-deadline notices, by email or push. The card still appears in the app.
- A member on a flagged branch who doesn't act is left out of:
  - the missed-suite run that leads to suspension after 3 misses
  - the `MissedActionDeadline` cohort rule
  - the admin missed-actions report
- Members routed to a flagged branch are not obligated, so a decision made for them after the deadline raises no late-decision warning.
- Admin completion-rate and reliability analytics give these members credit if they complete. The assignment is excluded from the member's assigned count unless they complete it. A completion counts in both the completed count and the assigned count.
- If a member on a flagged branch completes, the completion counts like any other completion, for example toward `usersCompleted`, `CompletedAction` rules, and prerequisites.
- The admin member×action matrix and the leader views show these members with the `optional_task` pill instead of `todo` or `missed_deadline`.
- Staff can turn the flag on or off at any time, including after launch and after the deadline. The change applies immediately to every member on the branch, including past suspension and analytics accounting.
- Optionality does not unlock prerequisites early. A later action that lists this one as a prerequisite unlocks for an optional member the same way it does today: when they complete or withdraw, or when this action's deadline passes.
- Moving a member between branches, by staff move or bulk re-route, changes whether they are optional to match their new branch.

### "Doesn't apply to me" withdrawal option

- The withdraw menu gains a fourth option, "Doesn't apply to me". The free-text explanation is optional for it.
- Like every withdrawal, it ends reminders, satisfies the suspension check, and resolves prerequisites.
- Admin completion-rate and reliability analytics do not count it as not completed. It is removed from the member's assigned count. Withdrawals with the existing reasons ("Took more than 15 minutes", "Moral objection", "Other reason") keep counting as not completed.
- It shows wherever withdrawal reasons show today: the event log, leader view, member progress pills, the admin withdrawal info panel, response exports, and the withdrawals-by-form endpoint.

### Form-defined opt-out ("skip if")

- A form can have one form-level "skip if" formula. It uses the same condition engine and editor as field and page `visibleIfFormula`, including cross-form conditions.
- While the formula is true for the member's current answers:
  - The submit button reads "Skip this action".
  - Required fields don't block submission.
- Submitting while the formula is true records a withdrawal with the reason "Doesn't apply to me", together with the answers given. Its consequences are the same as choosing that option from the withdraw menu, including the analytics treatment.
- While the formula is false, the form submits as a completion as usual.
- A branch's own form can carry its own "skip if" formula.

### Apps

- Member-facing changes land in web (`apps/frontend`) and mobile (`apps/mobile`).
- Staff configuration lands in admin (`apps/admin`): the branch flag, the optional-reason field, and the "skip if" editor.

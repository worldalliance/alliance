## Decisions

- The rule lives in `ActionFormVariantService.findSubmittedFormIds({ actionIds, userId })`, which returns the form each action's submission went to. That service already owns an action's variant forms, `TasksService` already depends on it, and the assignment code that also reads the rule lives there. It takes a list so the batch assignment path reads it in one query.
- An action's forms come from `actionFormIds` in `common/src/cohort-expression.ts`, the definition cohort divergence already uses, so "the action's forms" has one source too.
- `TasksService.assertActionNotSubmitted` wraps the rule with the `"Form already submitted"` error, so the submit and draft gates share both the rule and the message.
- `submitForm` no longer adds the submitted `formId` to the set it checks: `validateFormIdForUser` has already required it to be the action's task form or the member's assigned variant form, both of which the rule covers.

# Optional for member

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Optional branches are excluded reader by reader

`ActionBranchService.findOptionalBranchMemberIds` returns, per action, the members whose live `ActionFormAssignment` points at a variant with `optional = true`. Each reader that holds members to an action removes those members:

- reminder recipients (`filterForShouldRemind`), which every reminder group passes through, event-launch groups included; a suite reminder drops only the optional action, so the member is still reminded about the suite's other actions
- the suspension plan (`buildSuspendPlanContext`)
- the `MissedActionDeadline` leaf (`computeMissedActionDeadline` takes `onOptionalBranch`)
- the missed-actions report
- the admin member×action matrix pill
- completion-rate analytics (see Analytics)
- late decisions (see Late decisions)

`computeActionAssignment` and the base roster (`findBaseUsersForEvents`) stay unchanged. The roster also feeds the joined counter and forum auto-completion, and an optional-branch member must still be able to join and be auto-completed. `findUncompletedTasks` needs no change: it already drops tasks the viewer status marks optional where the action isn't optional for everyone.

Optionality is derived at read time from the live assignment and the variant's current flag, never stored per member. That is what makes "flip anytime" and "moving branches changes optionality" hold without a backfill. Flipping the flag doesn't undo a suspension that was already issued. Only the accounting from then on changes.

## Data

- `action_form_variant.optional boolean not null default false`
- `action_form_variant."optionalReason" varchar null`

These columns are allowed on A/B split variants too. Nothing about the flag depends on rule routing, so a restriction would be a validation branch with no user. Action-level `Action.optional` stays as is and stays locked after decisions exist. A member is optional if either flag applies.

## Viewer status

`ViewerOptionalReason` gains `Branch = "branch"`, and `UserActionStatus` carries `optionalReasonText` (the branch's `optionalReason`, or null). `resolveUserActionStatus` takes the viewer's assigned variant, which `applyAssignedVariants` now returns. Contract-gap keeps precedence when both apply, since its copy explains a time-limited situation. Existing clients map an unknown reason to `ViewerOnlyOptionalReason.Unknown` → "This action is optional for you.", so older mobile builds degrade to the generic line. `isDeferredForViewer` defers both reasons. The action page and home card show `optionalReasonText` as the description under the generic "optional for you" title (`withOptionalReasonText`).

## Late decisions

The "obligated" check in `cohort-decision.service.ts` (around lines 292-298) reads the branch that `resolveRoutedCohort` chose for the member. A member routed to an optional branch is not obligated, so a decision made after the deadline includes them instead of writing `included=false, ResolvedAfterDeadline`. It also raises no `warnAboutLateDecisions` log.

## Withdrawal storage

Withdrawal reasons are encoded as the `isMoral` / `outOfTime` flags on `ActionActivity`. A new nullable `doesntApply boolean` column joins them. `WITHDRAWAL_OPTION_LABELS` gains `doesnt_apply: "Doesn't apply to me"`, and `withdrawalFlagsFromOption` / `withdrawalOptionFromFlags` handle it. Clients built before this change decode such rows as "Other reason", which is acceptable. `WITHDRAWAL_OPTION_REQUIRES_REASON.doesnt_apply = false`. Web and mobile get an icon for it in their `WITHDRAWAL_OPTION_ICONS` records.

## Analytics

`member-retention-analytics.service.ts` counts an assignment in the denominator unless one of these holds and there is no completion:

- the member is on an optional branch
- the member's latest terminal activity is a `doesnt_apply` withdrawal

A completion always counts in both the numerator and the denominator. The `includeOptional` toggle keeps governing action-level optional only.

## "Skip if" is evaluated on the server

`formSchema` gains an optional `skipIfFormula`, with the same shape as `visibleIfFormula`. It is checked by `form-schema-validate.ts` and walked by `form-conditions.ts`. The client uses it only to relabel the submit button and to relax required-field checks.

The web and mobile renderers evaluate the formula with `isFormSkipped` (`common/src/forms/skip-if.ts`) against the answers the member can see. While it holds, the Next/Complete button becomes "Skip this action" on whatever page they're on. Pressing it goes through the existing withdrawal handler with `doesnt_apply` and the answers so far (`POST tasks/optout`). That way the client records it as a withdrawal, not a completion: no confetti, and the cached relation becomes `declined`. Only forms that offer withdrawal (`onAbandonAction`, which follow-up and public forms lack) can be skipped.

`TasksService.submitForm` also evaluates the formula on the server (`validateFormSubmission` with `honorSkipIf`). When it holds, required checks are relaxed, the answers are saved, and a `doesnt_apply` withdrawal is recorded instead of a completion. This covers a client built before this change, which still shows "Complete". Answer-shape checks such as range and ranking validity still run. Follow-up submissions pass `honorSkipIf: false`.

Conditions that rely on client-reported results (`validator`, `deviceType`) use the values the client submits in `visibilityValidatorResults` / `deviceType`, the same way `stripHiddenAnswers` does today.

Saving a `skipIfFormula` on the form of a contract-signing action is refused with an error. Those actions can't be withdrawn, and silently ignoring the formula would let an author ship a form whose skip never works.

## Admin

- Branch editor: an "Optional for members on this branch" checkbox, plus a reason text field shown when the box is checked.
- Form editor: a "Skip if" formula section reusing the visible-if condition builder.
- Matrix and leader views: the `optional_task` pill from the per-member assignment.
- A "Skip" tab in the form builder edits `skipIfFormula` with the visible-if condition editor. Its validation issues link to that tab.

## Out of scope

- Notifying members when a branch's optional flag changes.
- A distinct reason or analytics bucket separating form "skip if" opt-outs from the withdraw-menu option. Both record `doesnt_apply`, and the saved answers tell them apart if ever needed.
- Retroactively lifting suspensions after a flag flip.

## File size

These changes add to files already over the 500-line limit, and no split was made first: `actions.service.ts`, `cohort-decision.service.ts`, `tasks.service.ts`, `form-schema.ts`, `visibility.ts` (two `export` keywords only), and both `FormRenderer.tsx`. Each addition is a few lines. Splitting them is a separate refactor.

## Migration

`1793125059878-OptionalBranchesAndDoesntApply` was hand-trimmed to its three `ADD COLUMN` statements. The local database's schema had drifted with other branches' changes, which the generator also picked up.

## Tests

Unit:

- the viewer status for an optional branch, including the reason text, the contract-gap precedence, and a member outside the cohort
- the `MissedActionDeadline` leaf with `onOptionalBranch`
- `countsTowardCompletionRate`
- the withdrawal flag round-trip, including `doesnt_apply`
- `isFormSkipped`, including answers on hidden pages
- the skip-formula reference check
- the home card copy and deferral for an optional branch
- the admin branch editor saving `optional` and `optionalReason`

E2E (`server/test/optional-branches.e2e-spec.ts`):

- the viewer status over HTTP
- the reminder filter skips the optional-branch member
- a late decision onto an optional branch is included
- a true skip formula with missing required fields records a `doesnt_apply` withdrawal, while a false one is rejected
- the skip formula is refused on a contract-signing action

The suspension plan and the retention and missed-actions analytics have no test that exercises the exclusion end to end. Their per-member rule is unit-tested only where it is a pure function (`countsTowardCompletionRate`).

# Rule-routed action branches

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Reuse the variant machinery

A branch is an `ActionFormVariant` with a `rule` (a cohort expression) instead of a `splitValue`. A database check (`CHK_action_form_variant_split_xor_rule`) requires exactly one of the two. `ActionFormVariantService.createVariant` refuses a variant of the other kind than the action's live ones. Whether an action routes by rule is derived from its variants (`isRuleRouted`), not stored on the action. `position` orders branches, and the first match wins.

`ActionFormAssignment` stays the sticky per-member record. `overriddenAt`/`overriddenById` mark a staff move. Per-variant stats, merged responses and `actionFormIds` keep working unchanged. Rule-routed actions have no "Default" stats row, because a member on no branch isn't assigned.

The assignment reads moved out of `ActionFormVariantService` into `ActionFormAssignmentService` (`server/src/actions/action-form-assignment.service.ts`), because the variant service had grown past the 500-line limit. Staff moves and the re-route live in `ActionFormRoutingService` (`server/src/actions/action-form-routing.service.ts`).

## One routed expression for inclusion, first match for choice

Inclusion uses `routedCohortExpression` (`server/src/actions/action-branches.ts`), which builds `AND(action cohort, OR(branch rules))`. Every reader that evaluates an action's live cohort takes it from `ActionBranchService.loadRoutedCohortExpression`, memoized per `CohortResolutionSession`:

- the decision passes (`resolveAction`, `resolveBackfill`)
- `resolveActionCohortMemberIds`
- `computeIsInActionCohort`
- the divergence check
- the path-disagreement check

So all of them agree on "matches no branch → out". The branch choice is a separate step: `CohortResolverService.resolveRoutedCohort` evaluates each rule on the same session and `firstMatchingBranchIds` picks the first.

## Routing rides the cohort decision

`decide()` attaches the chosen branch to each included row. `CohortDecisionService.insert()` writes the `ActionFormAssignment` rows in the same transaction as the decisions, with `orIgnore`, so a concurrent writer's row wins for both. Lazy assignment on read (`getOrCreateAssignedVariantsForActions`, `getOrCreateAssignedFormId`) keeps working for split actions but never creates an assignment on a branched action.

A staff cohort correction that includes a member on a branched action gives them their first matching branch, or the first branch when none matches. Excluding a member leaves their assignment in place, which is harmless because they no longer see the action.

A public-only action can't take branches: it never gets cohort decisions, so nothing would route its members.

## Copy

`applyVariantToAction` lays a variant's form and copy overrides over the action entity before the `ActionDto` is built. It runs for the member's feed, the action page, the timeline feed, and reminder task lists (via `findUncompletedTasks`).

- The reminder keyword `#{action}` reads the member's branch name through a read-only lookup, so a reminder never creates an assignment.
- In-app notifications and their pushes name an action per recipient. `NotificationReferences.referencesFor(recipientId)` overlays the recipient's branch name.
- Forum posts, social feeds, search and the activity socket keep the base copy.

## Staff moves and re-route

- **Completion reset.** A move soft-deletes the member's `USER_COMPLETED` activity for the action, which puts them back to joined and clears the duplicate-activity guard. `usersCompleted` is then reloaded. Soft delete cascades, so likes and comments on that completion activity are hidden with it.
- **Submission guard.** The duplicate-submission guard (`hasSubmittedAssignedForm`) still refuses a second submission on any of the action's forms, except for a staff-moved member, who is checked only against the form they're on now.
- **Re-route.** It considers live assignments without `overriddenAt` whose member has no response on their current branch's form. It evaluates the rules over the active roster, moves only members whose first match changed, and re-checks submission and override under row locks before writing.
- **Notification.** The notice is a `NotificationCategory.ActionBranchMoved` row with `shouldPush`, mapped to the `ActionUpdates` notification kind. Its message is "Your action is now {action}", which renders with the recipient's branch title.

## Admin

The Form Variants tab offers "Random split (A/B test)" or "Route by rules" until the action has variants; after that the variants decide. Branches are edited in place: name, rule (`CohortExpressionBuilder`), copy overrides and images (`useCoverImage`), and order (up/down). After any rule edit or reorder, the tab asks the server for a re-route preview and offers "Re-route members" when it would move anyone.

Each branch's cohort preview shows what routing would give it.

- **How it's computed.** `POST /actions/:id/form-variants/routing-preview` takes the saved rules of the earlier branches plus this branch's draft rule. It resolves the action's cohort with prerequisites ready (`CohortResolverService.resolveReadyMemberIds`, the same path the decisions take), then routes by first match. A composed client-side expression couldn't express prerequisite readiness.
- **How it's drawn.** Members routed to the branch show solid green. Members its rule matches but who go to an earlier branch, or fall outside the cohort, show light green (`bg-emerald-500/30`).
- **Which members.** Like the action's own cohort editor, the dots cover only members with an active contract, since decisions skip the rest. A members table lists every assignment, with a move control on each row.

## Known gaps

- Dependency analyses still read only the action's own expression: catch-up ordering (`decisionReadActionIds`), `findUnawaitedOpenReferences`, and reminder grouping. A branch rule with a `CompletedAction` or `MissedActionDeadline` leaf isn't ordered behind the action it reads. Deleting an action named in a branch rule is blocked (`assertNotInACohort`).
- `scripts/import-fakes.ts` creates branches but refuses to replay participants on a branched action, since each member submits their own branch's form.

## Merging the 177–179 fakes

`.scratch/fakes/act-on-your-county-s-poll-worker-answer.yml` replaces the three files, which moved to `.scratch/fakes-superseded/`.

- The merged action's base copy is neutral, and its base form is 179's.
- Its cohort is `AllMembers`.
- Branches, in order:
  1. `field-county-status = "Yes"` on form 161 → 177's copy and form.
  2. `field-county-status = "No"` → 178's copy and form.
  3. `AllMembers` → 179's copy and form. This replaces 179's `NOT Yes AND NOT No`, because first match wins.

The fake format records no prerequisites, so the local action's prerequisite on 176 was set by hand, as it was on 177–179. Locally, actions 177–179 are archived and the merged action is 180.

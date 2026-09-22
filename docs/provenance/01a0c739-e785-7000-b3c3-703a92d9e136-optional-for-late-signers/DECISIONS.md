# Decisions

## Widen the contract check in place, no storage model

The user chose the narrow version over rebasing `stable-action-assignments`. So the rule lives where
the old one lived, in `computeAssignmentCore` (`server/src/utils/action-user.ts`), and is recomputed
per request from contract events. No table, no migration, no backfill, no admin controls.

Cost of this, against the branch: an assignment is not stable. It is a function of the contract
events and the clock, so a later suspension or resignation changes what the member was assigned
last week, and nothing records that an assignment was ever corrected by hand. The branch's saved
assignments exist to fix exactly that. If the stability turns out to matter, that branch is the
answer, not an extension of this one.

## Three-state assignment rather than a second boolean

The self-view entry point returns `ActionAssignment` — `Unassigned`, `Optional`, `Required`. A
parallel `computeIsOptionalForViewer` predicate would let the two drift: a user could read optional
but unassigned, and each call site would have to remember to ask both. The enum makes every consumer
name which of the three it means, and `Record`/`switch` exhaustiveness catches a fourth state if one
is ever added.

The self-view entry point was renamed `computeIsAssignedToAction` → `computeActionAssignment`, since
it no longer answers a yes/no question.

The shared rule, `computeAssignmentCore`, returns a private `CoreAssignment` — `Unassigned`,
`ContractGap`, `Required` — and takes no clock. Only `computeActionAssignment` turns `ContractGap`
into `Optional` or `Unassigned`, using `now`. The roster and the `assignedToAction` cohort leaf only
ask whether the user is required, and that answer never depends on the time, so neither takes `now`.
The cohort leaf calls `computeIsRequiredForAction`, the self-view shape narrowed to `Required`.

## The roster keeps today's behaviour; only the viewer widens

`computeIsAssignedFromCohortSet` reads a contract gap as false, so `computeIsAssignedAndPresent`,
and through it reminders (`filterForShouldRemind`), suspension accounting
(`buildSuspendPlanContext`) and the participant/`usersJoined` counter (`findBaseUsersForEvents`),
see exactly the set they saw before.

That is the point of the feature: a member who joined mid-window is not held to the action, so
reminding them, counting them as having missed it, or suspending them over it would all be wrong.
It also keeps the change's blast radius to the viewer's own status.

The `assignedToAction` cohort leaf (`ActionsService.computeIsInCohortExpression`) asks only for
`Required` for the same reason, and to preserve the invariant its existing comment claims — that the
single-user predicate agrees with the batch roster.

## Anchor the window's end, not `now`

`Optional` requires `hasActiveContractAt(deadlineDate ?? now)`. Two alternatives were rejected:

- No second check at all: every member whose contract missed the window would be assigned optionally,
  including a currently-suspended one. The roster filters over every user in the table
  (`findActiveUsersWithTags` has no `where`), so the contract check is the only gate; without this
  clause a suspended member gets this week's action back on their home page.
- `hasActiveContractAt(now)`: a member who signed up today would be assigned, optionally, to every
  action that ever ran, filling their history and their progress pills with optional entries for
  actions that closed before they existed. Anchoring on the deadline makes those `Unassigned`,
  because they held no contract when the window closed.

`Optional` also requires the member-action phase to have opened (`eventDate <= now`). Commit
`17c0f241d`, which shipped the client copy, states the contract: "The rule that widens optional sets
contract_gap only once memberActionStarted is true." The copy behind `contract_gap` says the task has
already been open. Without the guard, a member suspended before a phase that starts in the future,
who resigns before its deadline, would read `Optional` on a phase nobody has seen yet and be told it
had already been open. A new signer can't reach that state — against a future phase start their
contract covers the window, so they read `Required` — but the suspended-then-resigned member can.

A consequence worth naming: a member suspended mid-window who resigns before the deadline also lands
in `Optional`. That matches what `ViewerOptionalReason.ContractGap` already says it means — "the
viewer's contract missed part of the member-action window" — so it is treated as correct rather than
as a case to exclude.

`deadlineEvent` is the next event of any status after the member-action event
(`server/src/actions/utils/action-event.ts:24-29`), so `deadlineDate` is null only while the phase is
genuinely still open, and the `now` fallback applies only there.

## `ContractGap` is the only reason sent

`main` declares one variant. The branch adds `LateAssignment` and distinguishes it from `ContractGap`
by whether the contract covered the window, a split that only means something once assignments are
stored. Sending a second variant would also reach installed clients whose
`getViewerOnlyOptionalReason` doesn't know it; they'd fall back to `Unknown`. So this change sends
`ContractGap` for every viewer-only optional case.

## The legacy `shouldParticipate` field widens too

`shouldParticipate` is `assignment !== Unassigned`, so a mid-window joiner reads true there. A client
old enough to read `shouldParticipate` but not `viewer` will show the action as an ordinary required
task. Showing it as required was judged better than hiding it, which is the behaviour being fixed.
Current clients prefer `viewer` (`shared/lib/actionUtils.ts:205-208`) and are unaffected.

## Reminders leave viewer-only optional tasks out

Because `shouldParticipate` widens, `ActionsService.findUncompletedTasks`, which builds the task list,
count and time estimate inside reminders, would list a mid-window signer's optional action in any
other reminder they get. It now drops actions where `viewer.optional` is true but `action.optional`
is not.

"Their optional tasks" is read as the tasks optional for this user alone. Actions optional for
everyone stay in the list, and each reminder group keeps deciding about those with
`excludeOptionalActions`, as before. Dropping them too would silently override that admin setting.

## The viewer's pill reads the widened `optional`

`resolveUserActionStatus` passes its own `optional` to `resolveUserActionPillStatus`, not
`action.optional`. Otherwise a mid-window joiner would get `missed_deadline` once the deadline
passed, for an action they were never required to do. `ActionsService.findActionRelationsForUsers`,
which feeds the leader and admin member tables, still reads `action.optional`: those views describe
the action and its cohort, not one viewer.

## `ViewerOptionality`

`UserActionStatus` intersects with `{ optionalReason: null } | { optional: true; optionalReason: ViewerOptionalReason }`,
the guard PR #171 added so a reason can't be sent on an action left required. Assigning `optional`
and `optionalReason` as two independent locals loses that correlation and fails to typecheck, so the
pair is built as one `ViewerOptionality` value and spread.

## Threading `now`

`computeActionAssignment` needs a clock for the phase-opened check and the open-ended case, so `now`
is a required parameter rather than an internal `new Date()`, keeping the function pure and the tests
deterministic. `findMemberPublic` and `findOneDto` already had a `now` in scope.

## Tests

`server/src/utils/action-user.spec.ts` covers the rule: optional when the contract reaches the
deadline, unassigned when it doesn't, which date each window shape is anchored on, no widening for
onboarding actions, and that the roster predicate excludes the case the self-view predicate calls
optional.

It also covers `computeIsRequiredForAction`, true for a full-window contract and false for a
mid-window joiner.

`server/src/actions/user-action-status.spec.ts` covers what the viewer receives, against real `User`
entities: reason, pill, and that an action which closed before the member signed stays unassigned.

The end-to-end case in `server/test/actions.e2e-spec.ts` that asserted the old behaviour now asserts
the new one over the HTTP response, including `viewer.optionalReason`, and its title was corrected
to say what it checks. A second end-to-end case checks that `findUncompletedTasks` leaves the action
out for a mid-window signer and keeps it for a member whose contract covers the window.

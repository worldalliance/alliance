# Decisions

## Per-action correction on arms (user deferred how)

The user left open what today's single-decision correction (`CohortDecisionStaffService.correct`) does on an arm action. Recommendation (agent decision): reject it for arm actions, and offer two split-aware corrections in its place:

- **Move to arm**, per REQUIREMENTS.md **Staff moves**.
- **Remove from split**: excludes the member from every arm in one correction with one note, under the same window rule as a move.

Either way, a member always holds exactly one arm or none, which the routing preview and the streak can rely on. If staff need an escape hatch more than that guarantee, the alternative is to keep the plain flip and have the admin show members with two arms or none as a warning.

## Interpretations (agent decisions)

- An arm's rule and the split's filter are `CohortExpression`s, read by the existing evaluator (`cohort-expression.evaluator.ts`). No new rule language. The catch-all last arm stores no rule.
- `decisionReadActionIds` and `orderByDecisionReads` read a split's filter and rules as well as action expressions. Suite 66's rules read `MissedActionDeadline` of 160 and 161, so its routing has to run after their decisions.
- For a member the split's filter doesn't reach, routing saves excluded decisions on every arm, so readers keep treating "no row" as "not yet decided".
- Excluded decisions on the arms a member wasn't routed to carry the same `CohortDecisionReason` as the included one. An arm decision doesn't need a new reason. A move and a removal use `StaffCorrection`.
- Routing waits for the latest-resolving input across all arms, so a member whose arm needs no prerequisite can wait on another arm's prerequisite. That is the cost of exactly-one routing (REQUIREMENTS.md **Routing**).
- "Combined" counts are computed at read time from the arms' `usersJoined` and `usersCompleted`. The arms' own columns stay per arm, for staff and analytics.
- Staff and admin views always show arms as separate actions. "Combined" affects only what other members see.
- Rejecting a mismatched launch date or deadline also covers suite-managed events, which already move together.

## Migration rules for converted splits (agent decisions)

These rules reproduce each suite's routing in the staging data loaded on 2026-11-09 (EVIDENCE.md **Hand-built splits in staging**). Before writing the migration, check the ids and expressions against prod with a read-only query, and stop if they differ.

| Suite | Arms in order | Filter |
| --- | --- | --- |
| 60 | 152: Tag `17b76614-…`; 149: catch-all | none |
| 64 | 158: NonUSMember; 157: catch-all | none |
| 65 | 161: NonUSMember; 160: catch-all (was USMember) | none |
| 66 | 163: the manual list from 163's expression; 162: CompletedAction 160; 164: CompletedAction 161; 163: catch-all | none |
| 69 | 171: form 152 field `field-1791325884932` = "Yes"; 169: catch-all | none |
| 71 | 176: the OR of the four form 154/156 `option1` answers in 176's expression; 174: catch-all | none |

- Suite 66 keeps one position per action: 162 (CompletedAction 160 AND NOT the manual list), 164 (CompletedAction 161 AND NOT the manual list), 163 catch-all. Those are 162's and 164's expressions today, so routing matches the table above without letting an action hold two positions.
- The migration can't query prod, so it compares each arm's current expression, optional flag and suite with the staging values and throws when any differ, stopping the deploy.
- The migration logs each converted split's members who hold two included arms or none, and leaves them as they are.

## Arm routing in the cohort-expression column (agent decision)

Storing the routing expression on the arm action (REQUIREMENTS.md **Model**) keeps every reader of `action.cohortExpression` correct without changes: the live-cohort resolvers, the visibility gate, reminders, divergence, and `decisionReadActionIds`/`orderByDecisionReads`, which then see a split's filter and rules through the arms. The routing expression for arm *i* is `AND(filter, NOT rule_0, …, NOT rule_{i-1}, rule_i)`, so the arms' sets are disjoint. Live readers before launch wait only on the arm's own prerequisites; the decision writer waits on all arms' prerequisites together and writes every arm's decision for a member in one transaction.

## Implementation choices (agent decisions)

- **One optionality helper.** `Action.splitArms` is an eager relation, so every `find` of an action carries its arm row, and `isActionOptional` (`server/src/actions/suite-split.ts`) reads the arm's flag through it. It throws when the relation isn't loaded rather than fall back to the action's own flag, which stays false on an arm. Query-builder loads that need the arm join it with `joinSplitDisplay`.
- **Routing writer.** The decision writers group a split's arms (`groupSplitArms`) and write every arm's rows for a member in one `insert`, so one transaction. A group takes its last arm's place in the read order. Arms are loaded with every sibling, and each waits on the union of the arms' prerequisites (`awaitSplitPrerequisites`). A member decided on any arm counts as decided on all of them.
- **Closed-arm reason.** Each arm is still resolved against its own optional flag, so after the deadline a member routed to an optional arm is included on it with its admission reason, while the required siblings record `ResolvedAfterDeadline` exclusions. That differs from **Interpretations** above (same reason on every arm) only in this late case, and keeps the existing `CHK_action_cohort_decision_after_deadline_excluded` rule intact.
- **Staff moves.** "Prerequisites met" means the member has completed each of the target arm's own prerequisites. A move and a removal both need a decision on every arm (the member has been routed), and they share the single-flip correction write (`applyCorrection`). The move dialog's warning comes from `GET cohort-decisions/action/:actionId/user/:userId/arm-move`. A submitted response is a `form_response` on the arm's task form.
- **Combined mode surfaces.** The arm page (`userCanOpenAction`) and the member action list or search (`listableActions`) open a combined arm only to members routed to it, by saved decision or live routing. Feeds (`visibleActionIdsForUser`) judge the arm by its own visibility and show it under the split's title, with `combinedSplitId` set: on `ActionActivityDto`, `GlobalFeedActivityGroupDto` and `GlobalFeedActionUpdateDto`. The global feed groups a split's arms into one activity group, and its facepile lists members across arms. The timeline feed uses the strict rule, so each member sees only their own arm there. `ActionDto.usersJoined`/`usersCompleted` are summed across the split for members (`findCombinedCounts`); admin DTOs keep per-arm counts. The community member view (`findMemberInfo`) shows the split once, under its first listed arm's id. Web and mobile render a combined item's title without linking to the arm or activity page, which would not open for most viewers.
- **File-size splits.** `ActionsService` writes moved to `ActionMutationsService`. `CohortDecisionService` persistence moved to `CohortDecisionStoreService`, and action loading to `CohortDecisionActionsService`. In both cases the split was proposed by a codex read-only run under the root `AGENTS.md` **File size** rule.
- **Removing an action from a split** hands the arm's optional flag back to the action and leaves its derived expression in place for staff to edit. Deleting an arm action is refused until it leaves the split.

## Assumptions

- Hand-built splits so far need only one level of split per suite: no arm is itself split. (agent decision)
- Analytics that report per action keep reporting per arm. (agent decision)

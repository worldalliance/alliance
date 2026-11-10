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

- Suite 66 lists 163 twice: once for the manual list, once as the catch-all. That needs an arm table that allows the same action in two positions, or a rule on the catch-all. The migration's author picks one and keeps the routing identical.
- Today 162 and 164 also exclude the manual list, which the first arm now covers.
- The migration logs each converted split's members who hold two included arms or none, and leaves them as they are.

## Assumptions

- Hand-built splits so far need only one level of split per suite: no arm is itself split. (agent decision)
- Analytics that report per action keep reporting per arm. (agent decision)

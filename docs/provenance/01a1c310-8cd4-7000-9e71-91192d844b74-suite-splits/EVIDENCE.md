# Evidence

## Hand-built splits in staging

Method: read-only queries against the local database after loading staging data (pii-pruned prod), 2026-11-09.

Same-suite groups whose cohort expressions complement each other, all sharing one member-action date and deadline within the group:

| Suite | Actions | Split by | Optional flags | Prerequisites |
| --- | --- | --- | --- | --- |
| 60 | 149, 152 | tag (149 NOT tag, 152 tag) | 149 f, 152 t | none |
| 64 | 157, 158 | NOT NonUSMember / NonUSMember | both f; 158 is titled "Optionally order…" | none |
| 65 | 160, 161 | USMember / NonUSMember | both f | none |
| 66 | 162, 163, 164 | completed 160 / missed or manual list / completed 161 | all f | 162 {160}, 163 {161,160}, 164 {161} |
| 69 | 169, 171 | NOT / form 152 answer "Yes" | 169 f, 171 t | both {167} |
| 71 | 174, 176 | NOT / form 154 and 156 `option1` answers | 174 f, 176 t | none |

- The task brief's actions 177–179 in project 32 don't exist. Action 177 exists in an earlier local copy only, in suite 72 with no project. No multi-action suite has an id above 71.
- In suite 69, 168 also reads form 152 "Yes", so Yes members get 168 and 171, and 168 is not part of the 169/171 split.

## Effect of making 158 optional

Method: same database and date.

- 219 members have a cohort decision on 158, and 27 are included.
- 21 automatic-suspension keys (`contract_event."autoSuspendKey"`) include suite 64.
- `ActionSuspensionService.buildSuspendPlanContext` (`server/src/actions/action-suspension.service.ts`) recomputes closed suites' outcomes on each run and skips optional actions. So flipping 158 would change past standings, but not the suspension events already stored.

## Conversion migration against staging

Method: ran `ConvertHandBuiltSuiteSplits1794275385336` against the local database loaded with staging data (pii-pruned prod), 2026-11-09, then counted each member's included arms per split from `action_cohort_decision`.

- The md5 and schedule checks passed for all six suites. The migration created six `per_arm` splits and wrote each arm's routing expression and optional flag.
- Every member with decisions holds exactly one included arm in suites 60 (221), 64 (219), 66 (237), 69 (249) and 71 (257). In suite 65, 221 hold one and 1 holds none.

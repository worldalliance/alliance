---
user: Charles Lien
task: Build Linear issue ALL-2177 (suite split model and grid) in the variable-framework branch and open its PR.
---

# Requirements

The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec` (change 6). Formulas are stored as `docs/provenance/01a1f4f1-c0d1-7100-ae2a-42c26b35cfee-store-named-expressions` set up, and member lists as `docs/provenance/01a20516-4769-7000-9ce3-200eeb2c261a-member-lists`.

## Delivery

- ALL-2177 is built in the `variable-framework` branch. (user-originated)

## Scope

- This work builds the part of ALL-2177 that works with what expressions can read today, member lists and formulas:
  - groups and their fallbacks, with the save block for a missing fallback
  - the grid with required, optional and not-assigned cells
  - the no-required-work tick, and the empty-group and covered-group save warnings
  - the preview counts, and the rule-health report: errors any previewed member's evaluation hit, and conditional branches no previewed member took
  - splits as dependents of formula saves and list deletes
  - at go-live, validating and pinning the formula and list versions the split reads in one atomic step, or "Launch failed"
  - decision rows with the per-row required/optional field, the group and the trace
  - completion limited to the group's row, and the old decision path ignoring split suites

  (agent-proposed, user-approved)
- The parts of ALL-2177 that only matter once a split can read something other than lists and formulas are left to the issues that add those inputs (ALL-2173, ALL-2175, ALL-2176, ALL-2184). These parts are waiting for earlier actions, pending members, the cutoff exclusion, the earlier-action deadline warnings, the same-suite read blocks, captures at group fix, table version pins and blocks on form reads. Until those issues build them, a split's save check refuses any read other than member lists and formulas, with an error saying so. (agent-proposed, user-approved)

## Which suites use splits

- Splits are opt-in. An admin turns a suite with no `member_action` event into a split suite, and it can't be turned back. Suites without a split keep the old cohort rules. Once ALL-2173 and ALL-2176 ship, a follow-up issue makes split the only kind of new suite. This relaxes the spec requirement that new suites use the new system until then. (agent-proposed, user-approved; supersedes, until then, the "new suites use the new system" requirement of 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)

## Launch

- "Begin launch process" and saving a `member_action` event are refused for split suites until ALL-2178 (launch checks) ships. Splits can be built and previewed, but not launched. (agent-proposed, user-approved)
- Split suites launch only once both ALL-2178 and ALL-2179 (staff moves between groups) have shipped, so a live split suite can always move a member. (agent-proposed, user-approved)

## Analytics

- Server analytics that read whether an action is optional use the decision row's required/optional field for split suites: retention and tenure count each member's task as required or optional by their row. (agent-proposed, user-approved)
- For an action in a split suite, the action-wide optional flag is derived from the grid: optional when every assigned cell is optional, required otherwise. Admin charts, dashboard copy and reminder previews keep reading it, so they stay right for actions that are required in every group they're assigned to, or optional in every one. (agent-proposed, user-approved)
- How the admin dashboard shows an action that is required for some groups and optional for others (required and optional counts, chasing only required members) is a follow-up issue that must ship before split suites can launch. (agent-proposed, user-approved)

## From the spec

Restated from `01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec` for the parts this work builds.

- A suite has one ordered split. Each member lands in the first group whose condition they match, and the last group is a locked "Everyone else". (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- Every action in a split suite sits in the grid of groups × actions. Each cell is required, optional or not assigned, so one action can be required for one group and optional for another. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- A group whose condition could be undecided for some member carries a fallback, picked by the admin: "Put them here" (the group matches) or "Continue to the next group". It applies only when the whole condition is undecided. Every save of the split is blocked while such a group has no fallback picked, with an error naming the group. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- Any group without required work, "Everyone else" included, gets a tick, "This group intentionally has no required work". Saving without it only warns. The tick clears when the group's kind of work changes (required, optional only, nothing assigned). (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- Saving warns about groups that match nobody today and groups that earlier groups provably cover, found with an "empty today" count and a simple structural check across named conditions; there is no general solver. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- The preview counts the suite's eligible population split into required work, optional work only, nothing assigned and couldn't decide, and explains that a member with only optional work neither gains a missed suite nor resets their streak. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- The preview reports rule health apart from the counts: errors any previewed member's evaluation hit, and conditional branches no previewed member took. (ALL-2177-proposed, user-approved)
- Saving a formula, or deleting a member list, that would break the split of a draft or scheduled suite is blocked, naming the suite and group and the reason; the admin may instead save it together with the fixed group in one save. Splits of live and finished suites are not checked. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- When the suite goes live (the `member_action` event's time), the exact versions of everything its split reads are pinned, formulas and list membership, after validating the whole split, in one atomic step. If validation fails, the whole suite doesn't go live: nothing is pinned, no decision rows are written, the failure is reported to PostHog, and the suite page shows "Launch failed" with the reason. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- A member's group is fixed once per suite and doesn't change when answers, settings or lists change later. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- A member's resolved group writes one `action_cohort_decision` row per action from the group's grid row, plus a per-row required/optional field that readers use instead of the action-wide optional flag for those rows; rows of other suites keep the action flag. The group and the evaluation trace (each group tried, the facts read, the outcome) are stored alongside. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- In a split suite, a member can complete only the actions in their group's row, and an undecided action is never shown by live cohort eligibility. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- A member whose group evaluation errors is never placed in "Everyone else". (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- In a split suite, a member's group changes only through a staff move. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)

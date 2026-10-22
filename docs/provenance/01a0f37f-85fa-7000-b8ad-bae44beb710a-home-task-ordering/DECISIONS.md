# Design

This is a specification, not authorization to implement. The user-approved behavior is in REQUIREMENTS.md. The implementation choices below are agent-authored.

## Ordering

Keep the existing numeric priorities, admin drag ordering, and new-item insertion divider. Treat priority as the baseline order, with equal values allowed. Retain the existing deadline, start-date, and item-type tie-breakers, then use item ID as a final tie-breaker. A unique numeric priority is not a correctness requirement, and no new ranking storage or migration is needed.

After existing eligibility filtering and baseline sorting, stably move non-onboarding actions that are optional only for the viewer because of a contract gap to the end. Use the server's viewer optionality and reason, rather than calculating signing dates again or counting assignments. Explicitly optional actions stay in the baseline sequence even when a late signer receives them. Do not manufacture a contract-gap classification when viewer data is absent.

Preserve relative baseline order within the ordinary items and within the deferred items. Apply this to all existing and future eligible tasks without storing a per-user priority or consulting onboarding completion. Finishing onboarding, passing a deadline, or signing again does not independently trigger a ranking change; eligibility and the server's current optionality remain authoritative.

On web, partition the task-card sequence. On mobile, partition the existing combined action/update sequence so deferred actions follow its other entries. Append repeatable follow-ups afterward using their existing newest-start-first order. Apply the same action ordering to the shared task selection and task lists, within their existing visible sections. Preserve web's current/upcoming/completed grouping and visibility rules; this change does not make overdue tasks appear in a sidebar that currently excludes them.

Keep personalized ordering separate from the baseline comparator used by the admin screen. A pairwise rule that conditionally compares a task against onboarding can produce inconsistent comparisons; a stable partition expresses the single exception directly and leaves onboarding ordinary.

## Admin inventory

Replace the default status-only filter with an inventory of items that can appear now, items with future home availability, and unscheduled drafts. Derive inclusion from the existing home eligibility rules without evaluating every member's cohort. Include an item even if no member currently needs it. In particular, an action in an office/completed phase must remain visible when its configuration permits a home task after the deadline.

Keep the existing Show all control for otherwise inactive items. Determine eligibility from configuration and supported viewer types, including staff previews, rather than treating an action status as sufficient evidence that it cannot appear. Public-only and completion-blocked actions are not ordinary member home tasks; show their actual reason for availability or inactivity rather than labeling them active solely from their dates.

Each reorderable row identifies its type and relevant state. Use concise badges, allowing multiple reasons: Active task, Onboarding, Available after deadline, Scheduled, Draft, and Staff preview. Draft rows explain that they are not on ordinary member homes. General updates show scheduled/active/expired or unscheduled state from their availability dates. Show all rows explain why they currently have no home placement. Badges describe potential availability, not a claim that every member sees the item.

Show the global baseline order, with an explanation that tasks optional only because a member joined late move after that member's other tasks. This is a conditional ordering rule, not an action-wide Optional badge. Explain that relative ordering of updates and tasks applies on mobile, while web displays updates separately.

List active and scheduled follow-ups in a separate read-only section in their effective order, even if no member has completed the parent yet. Include inactive/unscheduled follow-ups under Show all. Display the parent action, start/end availability, and that the form is repeatable and appears after tasks. Use the existing cohort/date/completion gates; submitting a response does not remove a follow-up. No follow-up priority column or new persistence is needed.

Preserve the admin access controls and existing save/error behavior. An inventory fetch failure must be visible rather than masquerading as an empty section. Reordering changes only the baseline ranks, not assignments, optionality, schedules, or follow-up availability.

## Scope

Implement later in the shared ordering logic, web/mobile consumers, and admin priority screen. Preserve task completion, dismissal, reminders, assignment rules, feed ordering, progress displays, and platform layouts. No arbitrary per-member priority editor, urgency categories, automatic deadline demotion, or onboarding precedence rule is part of this design.

## Implementation

- `isDeferredForViewer` (`shared/lib/actionUtils.ts`) defers an action whose `getViewerOnlyOptionalReason` is `ContractGap`. It has no onboarding check: the server assigns onboarding actions as required or not at all, never optional for a contract gap, so the "non-onboarding" condition above needs no code. A reason from a newer server folds into `Unknown` and is not deferred, since only the contract gap was approved for demotion.
- The final tie-breaker is ascending item ID inside `homePagePriorityComparator`, so the admin list, web, and mobile agree on ties.
- `useHomePageActions().todoActions` carries the partition, so web's task navigator, current task, and this-week/next-week lists all inherit it; the sidebar applies it within each week group, keeping that grouping. The navigator's own re-sort of `todoActions` is removed because it would undo the partition. Web sorts that are not task-card sequences (sidebar progress bars, completed parents, general updates) keep the baseline comparator.
- Mobile's action/update sequence moves to `interleaveActionsAndUpdates` in `shared/lib/homePage.ts`, so it is unit-testable without rendering the mobile screen.
- Admin placement lives in `apps/admin/src/lib/homePlacement.ts`, a pure function per item type over configuration and `now`. It recomputes an action's status from its events at `now` rather than reading the fetched `status`, so a cached list agrees with the event dates it compares:
  - Actions: archived, public-only, and completion-blocked (outside staff preview) are inactive with that reason. Otherwise badges are Active task (`member_action`), Onboarding, Available after deadline (`shouldCompleteAfterDeadline` on an action whose member action has started or is scheduled, since members only keep it after a phase they could act in), Scheduled (a future member-action event, not active, completion not blocked), Draft (no member-action event, status `draft`/`planned`), Staff preview (`staffPreview` before any member-action event). An action with none of these is inactive as closed.
  - General updates: unscheduled (no start date) stays in the default list with an Unscheduled badge, since members need a start date; a future start is Scheduled; a past end date is inactive as expired.
  - Follow-ups: active uses the member rule (`isFollowUpFormActiveAt`); a future start is Scheduled. No start date, an end before the start, or a past end is inactive. So is a follow-up with no cohort, or whose parent is archived, public only, or has no member-action date, each with its own reason, because no member receives it. Otherwise it reaches members at the first time from now on when the form is active and the parent has opened and isn't in draft (the server hides draft actions from members): Active if that is now, Scheduled if later. It is inactive, with the parent in draft whenever the form is open, when no such time exists, as when a parent is redrafted with no reopening. Inactive rows sort after live ones.
- Badge descriptions are `title` tooltips; inactive reasons render as visible text, since they only appear under Show all where the reason is the point.

## Acceptance checks for implementation

Use synthetic fixtures and reproduce the current late-joiner ordering failure before changing application code.

| Scenario                                                             | Expected result                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Baseline: ongoing task, onboarding, explicitly optional task         | Existing required participant keeps that order; late joiner sees onboarding, explicitly optional task, ongoing task. |
| Baseline puts onboarding above a required task                       | Both keep their admin-chosen positions.                                                                              |
| Admin interleaves optional and required tasks                        | Their relative order is preserved.                                                                                   |
| Several tasks are optional because of joining or rejoining           | All move last for that member, retaining their mutual baseline order.                                                |
| Member completes all onboarding                                      | Deferred tasks remain behind other eligible items.                                                                   |
| A visible task crosses its deadline                                  | Its baseline rank persists; the admin inventory shows its post-deadline availability.                                |
| Identical priorities, dates, and item types                          | ID resolves the tie consistently regardless of response order.                                                       |
| Task can be shown only after deadline, in the future, or to staff    | Default admin inventory includes it with the corresponding explanation.                                              |
| Unscheduled draft has no ordinary home placement                     | It remains orderable and clearly labeled.                                                                            |
| Member submits an active follow-up                                   | It remains repeatable after the task cards; admin representation is read-only.                                       |
| Mobile sequence contains an update, a deferred task, and a follow-up | Update precedes the deferred task; follow-up remains last. Web keeps its separate update layout.                     |
| Member completes or dismisses a task                                 | Existing removal behavior applies before the remaining items are ordered.                                            |

Check the inventory's inactive/expired Show all cases and failed loads, baseline admin save round trips, and both platforms' effective sequence. Run the repository-required checks for the packages changed during implementation.

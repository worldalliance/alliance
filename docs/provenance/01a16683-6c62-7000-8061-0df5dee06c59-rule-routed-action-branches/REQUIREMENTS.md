---
user: Alex Dorey
task: Let one action route each member to one of several forms by rule, replacing sibling actions that duplicate logic
---

## User-origin requirements

- One action can hold several forms, with logic that decides which form each member sees. This replaces the current pattern of sibling actions that duplicate logic, such as local actions 177–179 in project 32 ("Staff the 2026 midterm polls"), which branch on the county-status answer to action 176's form.
- A member must not be pulled from one form experience into another without staff deciding it. Routing changes only through the staff actions below, never on its own.
- The confirm dialog for moving members offers to skip notifying them.

## Agent-proposed, user-approved

### Branches

- A branch is a form plus a routing rule plus optional copy overrides, attached to an action. An action has zero or more branches, in a staff-set order.
- A branch's rule is a cohort expression, the same type and builder as `action.cohortExpression` (`FormFieldValue`, `Tag`, `CompletedAction`, `AND`/`OR`/`NOT`, …).
- A member gets the first branch, in order, whose rule matches.
- A member must match both the action's own cohort expression and a branch rule to be assigned the action. A member who matches the action's cohort but no branch is not assigned the action.
- A branch may override any of: name, short description, body, time estimate, header image, square thumbnail image, and square thumbnail alt text. An unset override falls back to the action's value.
- An action routes either by rule branches or by today's random A/B split (`splitValue`), never both.

### When routing happens

- A member's branch is decided once, at the moment their cohort decision for the action is made: at launch, at signing, or when their prerequisites resolve. After that it changes only through a staff override or a bulk re-route.

### Where branch copy shows

- For an assigned member, the API substitutes their branch's overrides in every action payload it returns to them: cards, the action page, reminders, push notifications, and email. Clients need no change to show branch copy.
- Anyone without a branch sees the action's base copy and form: the public share page, admin lists, and non-members.
- Surfaces showing another member's activity on a branched action show the base copy, so one member's branch is never revealed to another: friend and community feeds, forum posts, live activity, and search.

### Staff overrides

- Staff can move a single member to any branch of the action, whether or not the member matches its rule.
- Overrides work on both rule-routed actions and random A/B split actions.
- Staff can move a member at any time, including after they submitted. Their earlier response stays on record against the old form. A member who had completed the action goes back to `joined` and completes it by submitting the new branch's form.
- The move dialog has a "Notify member" checkbox, checked by default. When checked, the member gets a push notification and an in-app notice naming the action's new title.

### Rule edits after launch

- Saving a changed branch rule, or a reordering, on a launched action never moves anyone on its own. Admin then offers a bulk re-route as one confirmed action.
- The re-route re-applies the branch rules to every member who has not submitted the form of their current branch, skipping members staff moved by hand.
- A member who would now match a different branch moves to it. A member who now matches no branch keeps their current branch.
- The re-route confirm dialog shows how many members will move and has the same "Notify member" checkbox, checked by default.

### Data model

- Branches extend the existing A/B variant tables: `ActionFormVariant` gains the rule, order, and copy overrides, and `splitValue` applies only to split actions. `ActionFormAssignment` stays the sticky per-member record and records which staff member overrode it, and when.

### Existing data

- Once the feature exists, the recorded fakes in `.scratch/fakes` are rewritten so actions 177, 178, and 179 become one branched action under project 32, and the local database is updated to match (`/modify-action`).

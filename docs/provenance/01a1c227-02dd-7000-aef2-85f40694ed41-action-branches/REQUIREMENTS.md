---
user: Alex Dorey
task: Bring rule-routed action branches from the dorey/scratch branch to main, split out of the form-variants settings
---

## User-origin requirements

- Bring rule-routed branches (dorey/scratch commit 78f4a1f04) to `main`, split out of the form-variants settings. This follows review feedback on that branch, where branches were stored as A/B form-variant rows and edited on the Form Variants tab.
- Only branches are in scope. Optional branches, the "Doesn't apply to me" withdrawal reason and the form-level "skip if" formula (dorey/scratch commit 45539b580) are left for later work.
- One action can hold several forms, with logic that decides which form each member sees. This replaces sibling actions that duplicate logic, such as local actions 177–179 in project 32 ("Staff the 2026 midterm polls"), which branch on the county-status answer to action 176's form.
- A member must not be pulled from one form experience into another without staff deciding it. Routing changes only through the staff actions below, never on its own.
- The confirm dialog for moving members offers to skip notifying them.

## Agent-proposed, user-approved

### Separation from A/B variants

- Branches live in their own `action_branch` table, separate from `action_form_variant`. A/B variants keep their current table, behavior and Form Variants tab.
- Staff edit branches on a new "Branches" tab of the admin action dashboard.
- A member's branch is recorded on `action_form_assignment` in a new nullable `branchId` column beside `variantId`. At most one of the two is set. The same row records which staff member moved the member by hand, and when.
- An action routes either by rule branches or by the random A/B split, never both.
- The Form Variants and Branches tabs both always show. When an action already uses the other kind, a tab explains that and disables adding until the other kind's entries are deleted.

### Branches

- A branch is a form, a routing rule and optional copy overrides, attached to an action. An action has zero or more branches, in a staff-set order.
- A branch's rule is a cohort expression, the same type and builder as `action.cohortExpression` (`FormFieldValue`, `Tag`, `CompletedAction`, `AND`/`OR`/`NOT`, …).
- A member gets the first branch, in order, whose rule matches.
- A member must match both the action's own cohort expression and a branch rule to be assigned the action. A member who matches the action's cohort but no branch is not assigned the action.
- A branch may override any of: name, short description, body, time estimate, header image, square thumbnail image, and square thumbnail alt text. An unset override falls back to the action's value.
- A public-only action can't have branches.

### When routing happens

- A member's branch is decided once, when their cohort decision for the action is made: at launch, at signing, or when their prerequisites resolve. After that it changes only through a staff move or a bulk re-route.
- Cohort analyses that order or check an action's dependencies read its branch rules as well as its own cohort expression: catch-up decision ordering, the unawaited open-reference check, and reminder grouping. A branch rule with a `CompletedAction` or `MissedActionDeadline` leaf is ordered behind the action it reads, the same as that leaf in the action's own cohort expression.

### Where branch copy shows

- For an assigned member, the API substitutes their branch's overrides in every action payload it returns to them: cards, the action page, reminders, push notifications, and email. Clients need no change to show branch copy.
- Anyone without a branch sees the action's base copy and form: the public share page, admin lists, and non-members.
- Surfaces showing another member's activity on a branched action show the base copy, so one member's branch is never revealed to another: friend and community feeds, forum posts, live activity, and search.

### Staff moves

- Staff can move a single member to any branch of the action, whether or not the member matches its rule.
- Staff can also move a single member between A/B variants of a split action.
- Staff can move a member at any time, including after they submitted. Their earlier response stays on record against the old form. A member who had completed the action goes back to `joined` and completes it by submitting the new form.
- The move dialog has a "Notify member" checkbox, checked by default. When checked, the member gets a push notification and an in-app notice naming the action's new title.

### Rule edits after launch

- Saving a changed branch rule, or a reordering, on a launched action never moves anyone on its own. Admin then offers a bulk re-route as one confirmed action.
- The re-route re-applies the branch rules to every member who has not submitted the form of their current branch, skipping members staff moved by hand.
- A member who would now match a different branch moves to it. A member who now matches no branch keeps their current branch.
- The re-route confirm dialog shows how many members will move and has the same "Notify member" checkbox, checked by default.

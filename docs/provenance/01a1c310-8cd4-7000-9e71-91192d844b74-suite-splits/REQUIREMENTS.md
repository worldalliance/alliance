---
user: Alex Dorey
task: Spec splitting a suite's members across its actions by rule, so the suite, not sibling cohort expressions, decides which of several actions each member gets
---

Origin labels: (user) the user stated it; (user-selected) the user picked it over the agent's recommendation; (agent-proposed, user-approved) the user approved the agent's recommendation.

## Model

- A suite splits its members across several of its actions. Each arm stays a separate, full action. The suite holds an ordered list of arms, each with a rule, and a member gets the action of the first arm whose rule they match. (user)
- A split is stored in its own table: a split row belongs to a suite, and an arm row holds the split, the action, its position and its rule. (agent-proposed, user-approved)
- A suite can hold any number of splits alongside actions that aren't in any split. An action belongs to at most one split. (agent-proposed, user-approved)
- The last arm of every split catches everyone the split reaches who didn't match an earlier arm, so each member the split reaches gets exactly one arm. (agent-proposed, user-approved)
- A split has an optional split-level filter expression that decides who the split reaches at all. A member it doesn't reach gets none of the split's arms. (agent-proposed, user-approved)
- An arm takes its members only from the split: the arm action's own `cohortExpression` is cleared and can't be edited while the action is in a split. (agent-proposed, user-approved)
- Only regular actions can be arms. The server rejects onboarding, public-only, contract-signing and staff-preview actions as arms. Forum-participation actions are allowed. (agent-proposed, user-approved)

## Routing

- A member is routed once, after everything any arm needs has settled: the split's launch (or the member's signing, for a late signer) and the union of every arm's prerequisites. One transaction then saves included for the member's arm and excluded for every other arm. (agent-proposed, user-approved)
- All arms of a split share the same member-action (launch) date and the same deadline. Saving a split, or changing one arm's member-action or deadline event, is rejected unless every arm still matches. (agent-proposed, user-approved)
- Arms may have different prerequisites. Each arm keeps its own list for the member's "complete this first" display. (agent-proposed, user-approved)
- Routing is sticky: a later change to anything a rule reads (a tag, a form answer, country) doesn't re-route a member. Only a staff move changes a member's arm. (agent-proposed, user-approved)
- A split's arms, their order, their rules and its filter can be edited until the split launches. After launch, only the split's title, its visibility mode and its arms' optional flags can change, besides staff moves. (agent-proposed, user-approved)

## Staff moves

- Staff can move a member from one arm to another with "Move to arm". It requires a note and is recorded as a correction on both decisions together, in one transaction. (agent-proposed, user-approved)
- A move is allowed only while the split's arms are open or in catch-up, and only into an arm whose prerequisites the member has met. These rules are stricter than today's per-action correction, which has neither. (agent-proposed, user-approved)
- A completion or submitted response on the arm a member is moved away from stays on that arm as history. The move dialog tells staff when the member has a completion or a submitted response on their current arm. From the move on, only the new arm counts toward the member's missed-suite streak. (agent-proposed, user-approved)

## Optional arms

- Whether an arm is optional is a flag on the arm row. (user-selected)
- While an action is in a split, its own `optional` flag is forced to false and hidden in the admin action form. Every reader of an action's optionality (reminders, the missed-suite streak, member status, notifications, analytics) goes through one helper that uses the arm's flag when the action is in a split. (agent-proposed, user-approved)

## Visibility to other members

- Other members must be able to be kept from seeing which arm a member got. This is a setting in the suite's definition. (user)
- The setting is a mode on each split, with two values: (agent-proposed, user-approved)
  - **Per arm**: arms show to other members as ordinary actions, under each arm's own title and visibility mode, as hand-built splits do today.
  - **Combined**: other members see the split's staff-entered title in feeds and activity, and counts (joined, completed) summed across arms. An arm's page returns not-found to members who weren't routed to it. A member's own pages show their own arm.
- New splits default to **Combined**. (agent-proposed, user-approved)

## Existing hand-built splits

- A data migration converts the hand-built splits in suites 60 (actions 149/152), 64 (157/158), 65 (160/161), 66 (162/163/164), 69 (169/171) and 71 (174/176) into splits. Other actions in those suites, such as 159, 173 and 175, stay unsplit. (user-selected: convert by migration; agent-proposed, user-approved: these six)
- The migration creates split and arm rows with rules that reproduce today's routing, copies each action's `optional` flag to its arm, and clears the arm actions' own `optional` flags and cohort expressions. It doesn't change any saved cohort decision. (agent-proposed, user-approved)
- Action 158's arm stays required (flag false), as the action was when its suite ran, even though its title begins "Optionally". (agent-proposed, user-approved)
- Converted splits use the **Per arm** visibility mode. (agent-proposed, user-approved)

## Admin

- Staff set up a split in a Splits section on the admin suite page (`ActionSuitePage`): its arms, their order, each arm's rule and optional flag, the split's filter, title and visibility mode. (agent-proposed, user-approved)
- The suite launch panel's member preview shows each split's per-arm member counts and flags any member the split reaches who gets no arm. (agent-proposed, user-approved)
- After launch, an arm's cohort decisions view offers "Move to arm". (agent-proposed, user-approved)

## Scope

- The first version ships to the server, admin, web and mobile. Web and mobile change only for the **Combined** mode: the shared feed, activity and count components show the split. Members see nothing new about their own arm. (agent-proposed, user-approved)

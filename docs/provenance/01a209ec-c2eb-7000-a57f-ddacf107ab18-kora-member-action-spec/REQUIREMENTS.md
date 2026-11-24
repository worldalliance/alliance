---
user: Alex Dorey
task: A task that lets an active Alliance member do about 15 minutes of KORA bench review as part of their weekly task, running every 2 weeks, with the review embedded in the member's normal action flow and usable on mobile.
---

# Requirements

Builds on the member Kora review action (`ActionTaskKind.KoraReview`) and the scenario in
`01a1c30d-d268-7000-8677-b1f0c4aa3ce8-active-member-kora-reviewer`. Supersedes the behaviour there and in
`server/src/actions/kora-action.listener.ts` where a member's first Kora assignment completes every Kora action.

## Who and when

- Active Alliance members get a Kora review task every 2 weeks, as part of their weekly task. (user-originated)
- Admins create and launch each Kora review action themselves, as a normal action with its own cohort and deadline; nothing creates or repeats actions automatically. (agent-proposed, user-approved)
- Code and tests don't name the every-2-weeks cadence; it lives only in how admins schedule the actions. (user-originated)

## Rollout

- No member Kora actions and no KORA data are live in production. The only KORA data is KORA's 88 test conversations, on staging and locally. (user-originated)
- The feature is demoed by launching a Kora review action on staging, reviewed against those test conversations. (user-originated)

## Where the review happens

- The review takes place inside the action, not on the Kora project's pages. On web, the review tool is mounted on the action's own page, with no Kora project navigation, and finishing returns the member to the action's "Task complete" card. (agent-proposed, user-approved)
- On mobile, the action's task panel opens the review in the app's WebView screen, showing the same bare review view (no Kora project navigation), and returning to the action shows its updated state. (agent-proposed, user-approved)
- The review stays the `kora_review` task kind; it is not a new element type in the task form. (agent-proposed, user-approved)
- Finishing the assigned conversations completes the action and returns the member to the action's "Task complete" card, which tells them they can keep reviewing if they like. (agent-proposed, user-approved; restated from `01a1c30d-d268-7000-8677-b1f0c4aa3ce8-active-member-kora-reviewer`)

## What completes an action's task

- A Kora review action's task is done at whichever comes first: the member finishes the assignment's conversations (a fixed number, sized to take about 15 minutes), or the member has spent 15 minutes of active review time on it. (user-originated, choosing between agent-proposed options)
- When the 15 minutes run out partway through a conversation, the task completes once the member finishes that conversation, not before; no half-graded conversation completes the task. After that, the finish screen offers to review more, as today. (agent-proposed, user-approved)
- While reviewing, the member sees their progress in conversations only (as today); the time counts silently, with no minutes shown. (user-originated, choosing between agent-proposed options)
- Each action's task counts alone: only the review work started from that action completes it. Reviews a member does beyond it still count toward KORA and their running total but never toward a later action's task. (agent-proposed, user-approved)

## No conversations left

- When a member opens a Kora review action's task and there are no conversations left for them (they have reviewed everything open, opted out of the remaining topics, or no batch is open), the server completes the action for them and the task panel says "No conversations to review right now. This task is done." It counts as an ordinary completion. (agent-proposed, user-approved)

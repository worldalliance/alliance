---
user: Charles Lien
task: Specify items 1 and 2 of Automated Messages Report (3), including missed-suite suspension and late-completion rules
---

## Scope and user clarifications

- Specify report items 1 (first missed suite) and 2 (second consecutive missed suite). Implementation is a subsequent task.
- Use existing history for the rule change. The user rejected rollout-date tracking and requested a staging-data comparison of partial versus entirely missed suites.
- Dismissal only controls whether an action appears on the home page; it must not affect assignment, reminders, completion, or suspension accounting.
- Accepted late completions count toward satisfying their suite and breaking a missed streak. The backend must reject ordinary late submissions when `shouldCompleteAfterDeadline` is false, aligning completion availability across backend, web, and mobile.
- Keep the report's member-facing wording, including “weeks” and “tasks.” Suites are an admin-only concept. Handle “it” versus “them” when multiple tasks are named.
- Update agreement wording and other explanations of the suspension policy; existing members need not re-sign.
- Messages run automatically. Experiment assignment and delivery information must be stored in the database for manual review.
- Keep existing delivery-failure behavior rather than introducing the agent's proposed retry policy.
- The user requested that the agent's treatment of unequal deadlines within a suite be recorded only in DECISIONS.md.

## Agent proposals explicitly approved by the user

These choices originated with the agent. Their approval is user-origin; their design rationale is in DECISIONS.md.

- Apply the stricter suspension rule to everyone: missing any assigned required action makes a suite missed; three consecutive missed assigned suites cause suspension. A/B testing applies only to first-miss copy, and everyone receives the same second-miss warning.
- “First miss” means the start of every new missed streak, including for established members. Satisfying all required actions in an assigned suite resets the streak.
- Suites with no required assignments for the member leave the streak unchanged. Preserve away and assignment exemptions, exclude optional and onboarding actions, and reset on re-signing.
- Preserve “won't complete” as satisfying an action for suspension accounting.
- Require a current, unbroken three-suite missed streak for suspension. An older qualifying streak followed by a satisfied suite must not cause suspension.
- Replace competing missed-deadline messages for a suite with one first- or second-miss message per applicable channel. On the third miss, send only the existing suspension notice.
- Use a stable 50/50 split by member for first-miss copy, shared across channels and recurring first misses. Preserve existing copy for the control; no experiment dashboard is required. The user chose database records and manual review rather than automatic analysis.
- Respect existing email, SMS, and push preferences. Eligible members receive an in-app notice on web and mobile; links and notification taps open the tasks page.
- Both first-miss experiment groups receive an in-app notice. The control uses existing push copy; the variant uses the report's app copy.
- Preserve staff's ability to record completion corrections after a deadline, even when ordinary late submissions are prohibited.

## Selected report copy

Source: the user supplied `Automated Messages Report (3).md` and selected items 1 and 2. The following copy preserves that source, with the requested singular/plural correction expressed using the existing `#{it|them}` template syntax. Keep these explicit subjects; do not derive a subject from the greeting or rewrite “week” as “suite.”

### First miss — variant

Push and in-app:

```text
The deadline for #{tasknames} passed without your completion.
```

SMS:

```text
The deadline for #{tasknames} passed without your completion. If you did complete #{it|them}, contact us. #{link}
```

Email subject:

```text
The deadline for #{tasknames} passed without your completion.
```

Email body:

```text
Hi #{firstname},
The deadline for #{tasknames} passed and we have no completion recorded for you. If you did complete #{it|them}, contact us; we may have made a mistake.
Each action is planned around the number of members expected to participate.
#{link}
```

### Second consecutive miss — everyone

Push and in-app:

```text
You have missed two consecutive weeks. One more pauses your agreement automatically.
```

SMS:

```text
You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically. #{link}
```

Email subject:

```text
You have missed two consecutive weeks of tasks.
```

Email body:

```text
Hi #{firstname},
You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically.
Completing this week's task resets the count.
If something has changed on your end or isn’t functioning in the platform, contact us.
#{link}
```

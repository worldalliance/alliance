---
user: Charles Lien
task: Specify social-proof copy in three-hour task reminders (item 6)
---

## User-origin requirements

- Produce a specification for item 6, social proof in task reminders. Implementation requires a separate request.
- Preserve the existing scheduling and late-dispatch behavior. Changing what happens when delivery crosses the deadline is outside this feature. Investigate undesirable current behavior and file a separate Linear issue if needed.

## User-supplied design and copy

The three-hour member task reminder has an A/B variant naming two members who have completed the relevant tasks. Prefer friends; use other completers when friends are unavailable. If fewer than two people qualify, send the standard reminder unchanged. The existing copy remains the control.

Push, without an in-app notification:

```text
#{timeremaining} left for #{n} task#{s}. #{names} have already completed #{it|them}.
```

Text message:

```text
You have #{timeremaining} left to complete #{n} Alliance task#{s}. #{names} have already completed #{it|them}. #{link}
```

`#{names}` represents the selected pair. For one task, `#{s}` is empty and `#{it|them}` is `it`; for multiple tasks, they are `s` and `them`. The text message ends with the existing task link.

## Agent-proposed, user-approved selections

### Scope and delivery

- Apply the supplied copy exactly to push and text. Email subject and body retain the reminder group's configured copy. Create no in-app entry for this reminder.
- Activate the experiment for existing and future member reminders configured for exactly three hours before the task deadline. Activation is automatic, without a per-reminder opt-in. Group-lead reminders and reminders at other timings retain their existing behavior.
- Preserve recipient selection, task-count rules, optional-task filtering, previously-notified exclusions, notification preferences, link destinations, channel delivery handling, and duplicate-send prevention.
- Control and fallback mean the reminder group's configured standard copy, including any custom wording; they do not mean resetting the group to preset text.

### Qualifying completers and names

- Each named person must have completed every task counted in this recipient's reminder. A completion of an unrelated task or only some of those tasks does not qualify.
- Use full display names. Exclude the recipient, anonymous accounts, deleted accounts, and accounts with blank names.
- Qualifying people can come from anywhere in the Alliance. A valid completer remains eligible if their agreement has since paused.
- A friend has an accepted friendship with the recipient. Pending or declined requests are not friendships.
- Choose two distinct people. With at least two qualifying friends, choose two friends. With one, choose that friend and one qualifying nonfriend. With none, choose two qualifying nonfriends.
- Select randomly within each pool, without choosing the same person twice. Use the same pair in push and text for a reminder. If fewer than two people qualify across both pools, use the standard copy.

### Experiment and measurement

- Assign each member independently with equal probability to control or variant. Save the assignment for this experiment and reuse it across reminders and channels, independently of other experiments.
- Control members always receive standard copy. A variant member who receives a fallback retains their variant assignment for future reminders.
- Record the assignment, actual copy sent, fallback reason, selected member IDs, and the task IDs represented by the reminder. Preserve existing delivery and click records so completion before the deadline can be compared later.
- A new reporting dashboard and additional click instrumentation are outside scope.

### Failure behavior

- If completer lookup fails, send the configured standard reminder and log the error. Distinguish lookup failure from a successfully evaluated pool containing fewer than two qualifying people.
- Preserve the existing reminder delivery path when social-proof lookup is unavailable; lookup failure does not change experiment assignment.

---
user: Charles Lien
task: Specify personalized recognition in action-update notifications (item 3)
---

## User-origin requirements

- Scope is item 3 of the notification proposal: personalized recognition on action updates. The request is for a spec; implementation has not been requested. The user believes items 1 and 2 are already complete; verifying or modifying them is outside this task.
- Copy should be clear, approachable, non-coercive, personalized, and specific. SMS ends with `#{link}`. Email subjects contain only the first sentence of the content body, excluding the greeting.
- A member with a completion event for the action is eligible for branch A. These members split 50/50 between A and B.
- `#{contribution}` derives from individual members' form answers, like a form variable. `#{alliance_result}` is an authored static string.
- Each update has exactly one notification type: normal or retrospective. Retrospective contribution wording is a separate field because its sentence requires different grammar.
- Existing update notifications remain unchanged and nothing is resent. New updates after the change cannot select the old-copy mode.
- Keep the existing audience selection, explicit send behavior, and notification link behavior.
- Notify on each enabled channel.

## User-supplied normal copy

| Channel         | Branch A                                                                       | Branch B                                          |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Push and in-app | Your #{contribution} led to #{alliance_result}.                                | Update: #{alliance_result}                        |
| SMS             | Your #{contribution} led to #{alliance_result}. #{link}                        | Update: #{alliance_result} #{link}                |
| Email subject   | Your #{contribution} led to #{alliance_result}.                                | #{alliance_result}                                |
| Email body      | Hi #{firstname},<br>Your #{contribution} led to #{alliance_result}.<br>#{link} | Hi #{firstname},<br>#{alliance_result}<br>#{link} |

The subject rule above limits either subject to its first content sentence if authored values contain additional sentences.

The supplied retrospective sentence is `#{weeksago} weeks ago you #{contribution}. #{alliance_result}. #{link}`. Its contribution token uses the separate retrospective field.

## Approvals of agent-origin proposals

These choices were proposed by the agent and approved by the user; their rationale and detailed behavior are in [DECISIONS.md](./DECISIONS.md).

- **Experiment:** Use A versus B as the experiment, without a third old-copy control. Non-completers receive B. Assign each member once, independently of other experiments, and keep the assignment across updates and channels.
- **Authoring:** Use the existing variable builder for two separately authored contribution formulas, restricted to this action's member answers. Store those fields and the static collective result per update.
- **Snapshot:** Include admin-recorded completions. Use the completion's linked form response. Freeze completion eligibility and resolved copy when delivery becomes due; subsequent edits do not rewrite sent notifications.
- **Validation:** Evaluate the selected mode's formula for recipients assigned A, highlight affected members and errors, and block sending on invalid or empty output. Formula-authored defaults may handle missing answers. Do not move invalid recipients to B. Revalidate before scheduled delivery and hold the update's notifications if validation fails.
- **Migration boundary:** Preserve behavior for updates that predate deployment, including unsent updates. Updates created afterward must use normal or retrospective recognition.
- **Retrospective delivery:** Apply retrospective A wording across all channels and retain B's normal copy. Email uses its first content sentence as the subject. Calculate whole elapsed weeks from each member's completion when delivery is due, using “1 week ago” or “Recently you…” below one week.
- **Channel settings:** Reuse the existing action email/SMS preferences and retain the action-update-specific push preference. In-app notifications are created for the selected audience.
- **Measurement:** Record persistent assignment, actual delivered branch, mode, and channel delivery outcomes; distinguish a non-completer receiving B from a completer assigned B. Defer a reporting dashboard and new click/open tracking.

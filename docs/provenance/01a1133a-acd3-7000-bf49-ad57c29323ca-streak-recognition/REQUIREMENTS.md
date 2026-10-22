---
user: Charles Lien
task: Specify streak-recognition notifications (item 4)
---

## User-origin requirements

- Specify item 4 of the supplied notification proposal. Implementation has not been requested. Copy should be clear, approachable, non-coercive, personalized, and specific. Existing copy remains the A/B control.
- Count consecutive completed suites, treated as assigned weeks, rather than individual tasks. Milestones are 2, 3, and positive multiples of 5.
- A suite requires completion of every assigned required, non-onboarding task. Use existing completion logic without requiring completion before the deadline. Order suites by deadline.
- Exclude withdrawn tasks. A suite with no tasks remaining after withdrawal does not count toward the streak. Completing one required task and withdrawing from the other counts as one completed suite.
- Use existing history and exclude the Onboarding suite.
- Recognition replaces the suite's reminder within the default reminders and is a preset. A suite without that reminder sends no recognition.
- Keep the email body unchanged. Keep the SMS suffix copy unchanged; the supplied suffix includes the parenthesized link.
- Ignore item 6, social proof, in this spec; the user plans to change it separately.

## Approvals of agent-origin proposals

The following choices were proposed by the agent and approved by the user. Their operational details and rationale are in [DECISIONS.md](./DECISIONS.md).

- Skip suites with no required obligations, including excused time away. Restart the streak when the member signs again after an agreement pause. An entirely withdrawn suite neither increments nor breaks the streak.
- Add a separate **Streak recognition** preset occupying the **Two Day Range** slot in **Populate default reminders**. It sends ordinary copy to controls and members without a qualifying streak; it creates no additional reminder.
- Leave already-saved reminders unchanged. Enable recognition when an admin applies the new preset. Recognize each milestone at most once within a streak, even if several reminders qualify.
- Preserve the existing reminder's task count, filtering, deadline, and preferred delivery time, including its inclusion of optional unfinished tasks.
- Use weeks-based recognition wording. The agent proposed the sentence defined under Copy in DECISIONS.md; the user approved it, treating weeks as assigned suites despite historical calendar exceptions.
- Assign members independently to this experiment, permanently and 50/50, with one assignment across channels. Controls retain existing behavior, including no new in-app entry. Members receiving recognition get an in-app entry plus their enabled action-notification channels, using existing preferences.
- Record experiment assignment, actual copy, suite streak count, target suite, and channel delivery outcomes. Defer a reporting dashboard and new click/open tracking.

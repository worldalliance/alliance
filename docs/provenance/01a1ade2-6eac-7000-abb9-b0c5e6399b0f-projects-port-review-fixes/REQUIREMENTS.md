---
user: Alex Dorey
task: Fix the medium-and-above review findings on the projects port branch, one commit per bug, each commit naming the bug it fixes
---

## User-originated

- Each fix lands in its own commit whose message summarizes the bug it fixes.
- Fix these bugs:
  - Saving the action details form restores a slug that was just changed inline.
  - Saving an action renames its sole-action suite to the action's name even when the action's name did not change.
  - Branching on `ActionPhase` and `ActionStatus` in the admin projects UI is not exhaustive, so a new variant does not fail the build.
  - Scheduling a release accepts a launch in the past, which notifies members at once and cannot be unscheduled.
  - Creating follow-up forms concurrently on one action deadlocks, because the action row lock is upgraded from key-share to update.
  - Form slugs reach members through the member-facing action response's follow-up forms.
  - A form with a system-assigned `v`/`f` slug that moves to another action keeps that slug as if staff had renamed it, so it collides or lands in the wrong sequence.
  - "Save dates" on a scheduled release updates the launch and deadline events in separate calls, so a failure leaves only some of them changed.

---
user: Charles Lien
task: One source of truth for when an action event takes effect
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Land the item as one standalone commit.

Action events are half-open `[a, b)` intervals. The date on an action event counts toward the new event: an event dated `d` is in effect at time `t` exactly when `d <= t` and the next event's date is after `t`.

Origin: agent-proposed, user-approved

One helper, or a small set, is the single definition of which action event is in effect at a time, and every server check of whether an action event has started goes through it: the action's status, whether the member-action phase has started, cohort enrollment, the member-action window used for away status, and the action stats analytics. Code that works out the member-action phase by hand uses `memberActionPhase` instead.

Tests cover the exact instant of an event's date.

---
user: Charles Lien
task: Client code shares the server's definition of when an action event takes effect
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Land the item as one standalone commit.

Action events are half-open `[a, b)` intervals: an event dated `d` is in effect at time `t` exactly when `d <= t` and the next event's date is after `t`.

Origin: agent-proposed

Client code that decides which action event is in effect, what comes next, or whether the member-action phase has started uses the same definition as the server.

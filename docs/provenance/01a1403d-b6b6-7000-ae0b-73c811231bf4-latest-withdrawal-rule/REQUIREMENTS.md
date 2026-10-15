---
user: Charles Lien
task: One source of truth for "a member's latest completion or withdrawal decides their status on an action"
---

## Requirements

- A member's latest terminal activity on an action (their most recent completion or withdrawal) decides their status on it. Reads of that status share one implementation of the rule, so they cannot diverge when it changes. (user-originated)
- Choose what to deduplicate by which code should change together, not by lines removed. (user-originated)
- Sites that mean "ever did X" rather than current status are a different rule; they stay as they are, named with the reason. (user-originated)
- A test reproduces the withdraw-then-complete miscount before the fix. (user-originated)
- One deduplicated item, in a standalone commit. (user-originated)

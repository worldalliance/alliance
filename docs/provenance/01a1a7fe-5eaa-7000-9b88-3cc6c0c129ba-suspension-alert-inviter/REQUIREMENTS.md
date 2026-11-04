---
user: chonboncode
task: Add "invited by [name]" to the #alerts Slack message sent when a member's contract is suspended, e.g. "[production]: Suspending contract for Raha Helali Esfahani. failure code s-69-70-71", then open a PR.
---

# Requirements

- The automatic contract suspension alert posted to the #alerts Slack channel names who invited the suspended member, as "invited by [name]". (user-originated)
- The #alerts message for a member suspending their own contract (`<name> suspended their contract :(`) names who invited them the same way. (agent-proposed, user-approved)

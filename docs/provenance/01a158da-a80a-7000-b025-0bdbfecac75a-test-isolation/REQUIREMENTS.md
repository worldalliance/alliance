---
user: Charles Lien
task: Fix flaky tests in general, not only the one that failed CI
---

## User-origin requirements

- Fix the flaky test behavior in general: the mechanisms that let one test's leftovers fail another, not only the test that failed CI on PR #737 (ALL-1781).
- Fix the flaky tests already filed in Linear:
  - ALL-1694: the CommunityPage group chat tests can end before the chat's mark-read request goes out.
  - ALL-1659: the recognition e2e test "treats a completer who later withdrew as not completed", when the completion and the withdrawal share a timestamp.
  - ALL-1109: the home feed fill test that depends on the clock through a 30-minute seed rotation.
- Which general guards to add is the agent's choice.

## Agent-proposed, user-approved

- The preload cleanup from PR #737 (da778d4a0 on main, ALL-1781) is the base fix these build on.

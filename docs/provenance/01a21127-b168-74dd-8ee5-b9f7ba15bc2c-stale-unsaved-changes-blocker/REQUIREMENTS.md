---
user: Charles Lien
task: Fix ALL-2390 (the flaky FormulaPage test "stays where the admin went while a new formula's page loads") and open a PR.
---

# Requirements

- Fix ALL-2390: the admin test `stays where the admin went while a new formula's page loads` in `apps/admin/src/pages/FormulaPage.test.tsx` fails intermittently, ending at `/formulas/<new formula id>` instead of `/formulas`. (user-originated)
- If the failure is a real race that sends an admin back to the formula they left, fix the page; if it is only the test's fixed 50 ms wait, wait on a condition instead. (ALL-2390-proposed, user-approved)
- Open a PR for the fix. (user-originated)

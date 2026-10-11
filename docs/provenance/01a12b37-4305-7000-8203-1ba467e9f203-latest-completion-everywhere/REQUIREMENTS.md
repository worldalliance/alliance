---
user: Charles Lien
task: One rule for whether a member completed an action, everywhere it is read
---

## Requirements

- A member counts as having completed an action only when their latest terminal activity on it (a completion or a withdrawal) is a completion. Every server read of "member completed action" follows that rule from one source, so the reads cannot diverge. (user-originated)
- Reads that still counted any completion row follow the rule: the member's completed-action count (profile count and `completedActionCount` visibility conditions), the admin incomplete-users list, an action's participants, the community completed-actions count, follow-up form submission eligibility, and the waitlist metrics' first-action conversion. (user-originated)
- Analytics reads follow the rule unless a raw "ever completed" count is intended, decided per site from provenance; sites left alone are named with the reason. (user-originated)
- Each behavior change is reproduced by a failing test before the fix. (user-originated)
- One logical change per standalone commit. (user-originated)

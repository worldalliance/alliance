---
user: Charles Lien
task: Deduplicate the follow-up form active-window check
---

Find duplicated code and dedup one item in a standalone commit, chosen so that things likely to change together have a single source of truth and behavior cannot diverge, not by lines deleted.

From the agent's proposed list, the user picked "fix 1". Agent-authored context for item 1: clients decide whether a follow-up form is active with `isFollowUpFormActiveAt` in `shared/lib/actionUtils.ts`, which treats a form whose start date is in the future as inactive, while the server's `submitFollowUpForm` checked only that a start date exists, so it accepted submissions before the start date. The proposal was to move the predicate to `common/` and call it from both sides.

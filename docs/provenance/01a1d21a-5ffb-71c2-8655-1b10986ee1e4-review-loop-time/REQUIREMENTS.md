---
user: Charles Lien
task: Cut the review loop's time without losing review quality
---

- Cut the review loop's wall-clock time without losing review quality. How is left to the agent. (user-originated)
- Ship no more bugs than today: PRs that went through the full loop have introduced close to none. What reviewers review and what checks guard stays as it is; a fix the reviewers would call minor can still introduce a must-fix, so it still gets reviewed. (user-originated)
- Consider having each reviewer surface more findings per pass, so each round fixes more and fewer rounds are needed. A starting idea, not a requirement on the approach. (user-originated)
- Check whether agents spend review rounds elaborating things the user deferred or said they didn't care about, and address it if so. (user-originated)
- This PR makes these changes, each in its own commit (agent-proposed, user-approved):
  - A fixer stops its background tasks, monitors and wakeups once its report is done, so its run ends.
  - The hub runs rounds without asking whether to continue a loop the user already authorized.
  - Reviewer worktrees are reused across rounds instead of created and removed for every review.
  - Each loop runs at most four reviewers at a time.
  - When a choice the user deferred keeps drawing findings, the fixer simplifies or narrows it instead of adding to it.
- Reusing check results across runs, and pooling several reviewers per commit, are separate tasks, not this PR. (agent-proposed, user-approved)

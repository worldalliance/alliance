---
user: Charles Lien
task: Raise the server's database connection pool size immediately so the cron pool deadlock that stalled production can't recur, and open a PR.
---

# Requirements

1. Raise the server's database connection pool size so that the lock-taking cron jobs can no longer exhaust it and stall every request that needs the database. This is an urgent hotfix; the longer-term fix is separate work that follows the research into established practice. (User-originated.)
2. Set the pool size to 30 and make a request for a connection fail after 10 seconds instead of waiting forever. (Agent-proposed, user-approved.)
3. Ship it as a PR from a new branch off `main`. In the review loop, fix only the must-fix findings, because the change is urgent. (User-originated.)

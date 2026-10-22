---
user: Charles Lien
task: Manually run an agent review in GitHub Actions
---

- Add a GitHub workflow with separate inputs for the commit to check out and the commit or description of changes to review.
- Run `review-base`, `review`, or their equivalent, following the approach used to move PR screenshots into a workflow.
- Compare the workflow with reviews spawned through `claude -p` in fresh worktrees created by `scripts/new-worktree.sh`, on historical commits. Use only the review-spawning part of the supplied old prompt, not its fix, issue-filing, history-editing, or PR loop.
- Push freely to branches prefixed `charles/`; do not push to main.
- Keep the `user` field in this file unredacted.
- Move all changes into a new worktree on a branch prefixed `charles/`, then commit them in minimal standalone commits.

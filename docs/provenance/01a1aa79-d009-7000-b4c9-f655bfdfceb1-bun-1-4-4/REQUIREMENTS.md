---
user: Charles Lien
task: Upgrade Bun from 1.3.6 to 1.4.4, in a PR from a new worktree.
---

# Requirements

- Upgrade Bun from 1.3.6 to 1.4.4 wherever the repository pins it: CI and deploy workflows, the production backend host install, `packageManager`, `@types/bun`, and the install instructions. (user-originated)
- Deliver it as a pull request from a worktree made for it. (user-originated)
- Agent guidance keeps new env-var restores on `setEnv`, with reviewers catching what it misses; a lint rule belongs in this PR only if it adds little friction or scope. (user-originated)

---
user: Charles Lien
task: In the Alliance agent, rename "task" to "worktree", and let "New worktree" name a worktree without sending a message (ALL-2406); file the Linear issue and open a PR
---

This task supersedes, in `docs/provenance/01a204f2-97ae-7000-bf40-ed911ca661ae-alliance-agent-task-sidebar/` and the plans its requirements restate from (`docs/provenance/01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan/`, `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`), the requirement that starting work means typing a request under "New task" that creates a worktree named after it and starts a session in it, and the word "task" in every requirement it keeps.

## Worktrees

- The app calls what it called a task a worktree, in its interface and its code. (user-originated)
- "New worktree" asks only for a name and creates the worktree without sending a message. Starting a conversation is a separate step, taken in the worktree once it exists. (user-originated)
- Worktrees have no title apart from their name: the app shows the worktree's name. (agent-proposed, user-approved)
- Each worktree has one folder. "New conversation in this worktree" starts another conversation in it. (agent-proposed, user-approved; restated from 01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan)
- Worktrees are created through `scripts/new-worktree.sh`, and the app shows the creation's progress. (user-originated; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)

## Removal and archive

- Removing a worktree from the app is left to the already planned ALL-2318 and ALL-2319, and which worktrees the app may remove is decided when that work starts. (user-originated)
- Archive stays a reversible hide that keeps the worktree's folder, branch, databases and conversations. (agent-proposed, user-approved)
- The archived flag lives in the worktree scripts' record, as an `archived=1` line set by a new `scripts/archive-worktree.sh`, reported by `scripts/list-worktrees.ts`, and shown by `scripts/rm-worktree.sh --list` as cleanup candidates. (agent-proposed, user-approved)

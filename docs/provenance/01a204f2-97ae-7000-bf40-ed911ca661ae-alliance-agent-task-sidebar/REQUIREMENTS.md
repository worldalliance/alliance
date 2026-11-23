---
user: Charles Lien
task: Implement ALL-2035 (Alliance agent task sidebar, New task and Archive) and open a PR
---

## Tasks and worktrees

- Each task has one worktree. "New task" creates a worktree; "New conversation in this task" starts another conversation in the task's existing worktree. (agent-proposed, user-approved; restated from 01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan)
- The app shows the creation's progress. (agent-proposed, user-approved; restated from 01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan)
- Worktrees are created through `scripts/new-worktree.sh`, and the app shows them. (user-originated; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- Starting work means typing a request under "New task": the app creates a worktree named after the task, starts a session in it, and lists it in a sidebar of worktrees, each with its sessions. More sessions can be started in an existing worktree. (agent-proposed, user-approved; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- "Archive" is the everyday way to finish a task. It hides the task and keeps its folder, branch, databases and conversations, so restoring it is immediate. It neither commits nor pushes. (agent-proposed, user-approved; restated from 01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan)
- The app never deletes a worktree automatically, and never deletes one the app didn't create. (agent-proposed, user-approved; restated from 01a1eacc-f2ab-7181-b7d9-f8bf93c89797-alliance-agent-ui-worktrees-setup-plan)

## Conversations outside a task

- "New task" is the main way to start work. A secondary "Ask without a task" starts a conversation in the main checkout of the repository, with no folder picker, until the Setup work (ALL-2034) gives a path that needs no task, when it is removed. (agent-proposed, user-approved)
- Saved conversations whose folder is no task's worktree stay listed under "Other conversations" and still open. (agent-proposed, user-approved)

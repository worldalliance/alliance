---
user: Charles Lien
task: Child worktree creation and recursive cleanup
---

# Scope

Origin: user.

- Specify changes to `scripts/new-worktree.sh` and `scripts/rm-worktree.sh` as an independently implementable feature. Implementation comes before a planned desktop app. This provenance directory must stand alone and must not reference that app's provenance directory.
- Allow `new-worktree.sh` to run within the main checkout or any child worktree.
- Support macOS and Linux. Include Windows compatibility only where it requires trivial changes; omit a separate Windows port.
- These worktrees are predominantly managed by agents. Nontechnical coworkers must not have to clean up worktrees after stopping agents in the planned desktop app.
- Preserve the current source of copied configuration and initial database data: the main checkout, including when creating a child from another worktree.

# Lifecycle

Origin: agent-proposed, user-approved.

- Record the worktree that creates a child as its parent. Default the child's starting code to that parent's current commit.
- Removing a parent also cleans up its children and further descendants.
- Make cleanup usable after stopping agents and their child processes. Remove the selected worktree directories, their databases, and port reservations so stopped tasks do not leave active development environments behind.

# Removal

Origin: user.

- `scripts/rm-worktree.sh <name>` is the only removal command: it removes that worktree and all its descendants. Removing only a worktree's descendants while keeping the worktree is out of scope until it is needed.
- Removal deletes the branches `scripts/new-worktree.sh` created for the removed worktrees, even when they hold unmerged or unpushed commits, and discards uncommitted changes. Agents create worktrees constantly, most are not managed by the user, and the user is often unaware they exist. Anything removal leaves behind, a branch or a worktree, piles up, and the user does not know about the uncommitted or unpushed work in it.

# Options

Origin: agent-proposed, user-approved.

- `scripts/new-worktree.sh` takes `<name>`, `--branch <branch>`, and `--from <ref>`. Remove its `--slot` and `--force` options; ports always come from the lowest free slot.

# Concurrency

Origin: user.

- Support safe concurrent invocations by different agents, including multiple calls to `scripts/new-worktree.sh`, multiple calls to `scripts/rm-worktree.sh`, and creation overlapping cleanup.
- Concurrent calls must preserve resource ownership: successful creations receive distinct worktree directories, databases, and port reservations; cleanup removes only its intended worktree instances and their resources, including when a name is reused.

# Delivery

Origin: user.

- Implement the specified behavior in `scripts/new-worktree.sh`, `scripts/rm-worktree.sh`, and their documentation, with automated tests for the acceptance checks.

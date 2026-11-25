---
user: Charles Lien
task: Implement ALL-2027, a script listing the worktree registry as JSON for the desktop app.
---

# Requirements

- `scripts/list-worktrees` prints the repository's worktrees as JSON, each with its name, branch, path, ports and parent, under a top-level `version` field. (ALL-2027-proposed, user-approved)
- The desktop app reads this output instead of parsing the registry's record files (`<git common dir>/alliance-worktrees/instances/<id>/record`), and refuses an unknown `version` by offering to pull the latest `main`. The desktop side is not part of this task. (ALL-2027-proposed, user-approved)
- A test fixes the output shape for the main checkout, a child worktree and a half-removed record. (ALL-2027-proposed, user-approved)
- The script lists every worktree git knows (`git worktree list --porcelain -z`), each joined to its registry record, with a per-entry state: the main checkout, created by the worktree scripts, plain git with no record, half-created, half-removed, or an invalid record together with the problem text. Records with no git worktree appear too. Git's own `prunable` and `locked` flags are carried on each entry. (agent-proposed, user-approved)
- `version` is a single top-level integer, changed only for breaking changes; adding fields does not change it. (agent-proposed, user-approved)
- The script is written in Bun TypeScript and reuses the existing port derivation (`scripts/ports.ts`, `common/src/dev-ports*.ts`) rather than reimplementing it. (agent-proposed, user-approved)
- Record validation must not drift between two validators: either the TypeScript calls the bash validation (`record_problem` in `scripts/lib/worktree-registry.sh`), or both are kept and the fixture test exercises them on the same broken records. Which one is the agent's choice. (agent-proposed, user-approved)

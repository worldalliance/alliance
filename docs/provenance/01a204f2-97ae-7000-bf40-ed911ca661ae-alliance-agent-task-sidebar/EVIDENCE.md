# Evidence

Researched 2026-11-22 by a subagent run through the `claude` CLI, reading each product's own documentation. Statuses follow the root `AGENTS.md` **Established practice**: every finding here is a vendor recommendation for its own product, or common practice where two or more products do it. No formal standard or study covers these questions.

## Conversations without a worktree

- Claude Code desktop works in the project folder unless Worktree is turned on per session ([Claude Code desktop](https://code.claude.com/docs/en/desktop)). Codex offers Local or Worktree, with Handoff between them ([Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)). VS Code's Agents window picks Branch or New Worktree per session ([VS Code agents window](https://code.visualstudio.com/docs/agents/run/agents-window)). **Common practice**: a per-conversation choice between the folder and a worktree.
- Conductor puts every chat in a workspace ([Conductor docs](https://www.conductor.build/llms-full.txt)). **Vendor recommendation**.

## Naming and base

- Conductor gives unnamed workspaces a random city name and names the branch after the workspace; Paradev names it from the prompt with a short unique suffix ([Paradev workspaces](https://docs.paradev.com/workspaces)); Claude Code generates a name when none is given and branches `worktree-<name>` from the remote default branch ([Claude Code worktrees](https://code.claude.com/docs/en/worktrees)). **Common practice**: a generated name, the branch named after the workspace, and the remote default branch as the base.

## Archive

- VS Code, Claude desktop and Conductor keep archived items in the same list behind a filter or tab, with Unarchive or Restore ([VS Code sessions](https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions), [Claude Code desktop](https://code.claude.com/docs/en/desktop), [Conductor docs](https://www.conductor.build/llms-full.txt)). **Common practice**.
- VS Code, Codex and Paradev remove the worktree folder on archive and re-create it on restore; Codex won't archive a chat still in progress, since its archive deletes the worktree. **Common practice**, which the approved requirement here departs from by keeping the folder. None documents stopping a running agent on archive.

## Worktrees made outside the app

- Paradev imports them, Cursor treats them as eligible for deletion under its cap ([Cursor worktrees](https://cursor.com/docs/configuration/worktrees)), and Claude Code's cleanup keeps them. No common practice.

The subagent read only part of the Claude desktop page and of Conductor's documentation, so gaps reported for those two may be in what it read.

---
user: Charles Lien
task: A local panel for worktrees and agent workflows
---

# Requirements

## The panel

- New directory `(root)/agentic-workflows/`, opening a page served from localhost. This should be dev-only and have no effect on prod.
- Create and remove worktrees by running the scripts that already exist, `new-worktree.sh` and `rm-worktree.sh`.
- A button or trigger for a workflow, with a worktree to run it against. Only one workflow at a time per worktree.
- Show the local worktree state: the local commits, git status, and a link to the remote on GitHub.

## The review-base workflow

- Given a remote branch, run `rm -rf .scratch`, then `git commit-after {remote}` to get a SHA, then run `claude -p --dangerously-skip-permissions` with JSON output and the prompt ``/review-base base is `git show --stat <SHA>` ``, wait for it to finish, and show the final markdown output.
- Run `rm -rf .scratch` at the beginning of each workflow.
- Run `git commit-after` before `rm -rf .scratch`, in case `commit-after` fails.
- Do not depend on `git commit-after`. It is an alias the user has locally, and anyone who forks the repo will not. Extract the logic into the repo.

## Diffs

- A GitHub-like UI for viewing diffs.
- Clicking a commit shows that commit's diff. Highlighting a sequence of commits shows the diff of that set of commits.
- Show the insertions and deletions for each commit in the commits list.

## Workflow visualization

- A more visual workflow visualization, along the lines of n8n. Read-only for now.
- The bash script is its own step in the workflow, for example running `git commit-after xyz`.
- The workflow is visible before it is run, not only once a run starts.
- Clicking a workflow step opens a small modal with more detail, including the full command.
- Run claude with `--output-format json` and give each of the JSON objects a nicer UI.
- The user asked whether claude's output is streamed and why it was not visible in the modal.
- Each JSON message in the agent output is an accordion, closed by default.
- A nicer UI for inspecting the agent's output. A tool call showed `bash {"command": "cat xxx", "description": "Read listCards"}` where a preview belongs. Hardcoding the common cases is acceptable.

## Running a workflow step by step

- A button on each workflow step that runs that step and pauses.
- Steps may not be run out of order, and previous steps may not be re-run. The user offered this restriction as a simplification.

## Commits list and base ref

- Make it clear which commit is HEAD and which is the branch.
- Show `origin/main` in the commits as well.
- Make selecting the remote branch easier by clicking the selection in the commits table.
- Keep track of each remote branch in localStorage or similar.
- Move the remote branch selection out of the "review base" box, since it is independent of the workflow. Do not show it in the commits table either; put it near the top.

## GitHub link

- A link somewhere to the GitHub page of the selected branch.
- The "on github" button at the top should show and link to the upstream branch, or not be clickable when there is no upstream.

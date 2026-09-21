# agentic-workflows

Local control panel for the worktrees and for the agents that run in them. `bun run workflows` from the repo root, then http://localhost:6900 (`AGENTIC_WORKFLOWS_PORT` moves it).

Bun serves the API and bundles `ui/` from one process. Nothing persists: the job list lives in memory and a restart loses it.

## What it does

- Creates and removes worktrees by spawning `scripts/new-worktree.sh` and `scripts/rm-worktree.sh`. Both run in the main checkout, whatever checkout the panel itself was started from, because `new-worktree.sh` exits inside a linked worktree.
- Shows each worktree's ports, ahead/behind, working-tree changes, and the commits above a base ref. Each commit carries its own insertions and deletions, and the base commits sit below a divider so `origin/main` is always in reach. The header links the upstream branch on GitHub, and says `no upstream` rather than linking a local branch name that may not exist on the remote.
- The base ref is picked in the header and kept in `localStorage` per worktree. It sets both the commit list and what the workflow reviews, and clicking a remote badge in the commit list picks it too. The picker lists `origin` first, since the other remotes are forks.
- Renders diffs: click a commit for its own diff, shift-click a second one for the diff across that run of commits. The oldest commit's parent is the base, so a root commit diffs against git's empty tree.
- Runs the review-base workflow: `scripts/commit-after.sh <remote branch>` names the base commit, `rm -rf <worktree>/.scratch` clears the previous run's findings, then `claude -p --dangerously-skip-permissions --output-format stream-json` reviews it through `/review-base`. Resolving the base first means a ref that does not resolve costs nothing. The delete only ever touches the worktree being reviewed, never the main checkout.

A job is an ordered list of steps, so the panel draws the nodes before the run starts, and `GET /api/workflow` returns those same nodes for a workflow nobody has run yet. Each node carries its own log and output, a failed step marks the rest skipped, and the node shows the exact argv once it spawns. Add a workflow by writing `StepDefinition[]` in `workflows.ts`; nothing in the page knows what the steps do.

The header's play button runs the whole workflow. The button on a node runs that one step and pauses, and it only ever appears on the next pending step, so steps cannot run out of order or twice. A paused job still holds its worktree; stop it to release it.

Clicking a node opens its modal: the full command, the log, the output, and the agent transcript. `stream-json` prints one JSON object per line as the agent works, so the modal fills while the review runs. `json` buffers the whole array until the process exits, which is why the format matters. Every message is a row that opens on click, closed by default, carrying a one-line preview so a long transcript stays scannable. Open one for the parsed view, or toggle the raw object. Tool calls show their arguments as labelled fields for the tools in `TOOL_FIELDS`, and raw JSON for anything else. Transcripts are held in a side map and served by `GET /api/messages`, so the state the page polls every 1.5s stays small.

One job at a time per worktree, and one worktree script at a time across the repo. The panel refuses to remove the worktree it is running from, and refuses to remove a worktree with a job still running in it.

## Files

`server.ts` holds the routes. `src/` is the server: `worktrees.ts` reads git state, `diff.ts` runs and parses `git diff`, `jobs.ts` owns the job registry and subprocess logging, `workflows.ts` builds the three jobs. `ui/` is the React page.

Dependencies resolve from the repo root's `node_modules`, so this package declares none of its own.

# agentic-workflows

Local control panel for the worktrees and for the agents that run in them. `bun run workflows` from the repo root, then http://localhost:6900 (`AGENTIC_WORKFLOWS_PORT` moves it).

Bun serves the API and bundles `ui/` from one process. The job list lives in memory and a restart loses it; review archives persist on disk.

## What it does

- Creates and removes worktrees by spawning `scripts/new-worktree.sh` and `scripts/rm-worktree.sh`. Both run in the main checkout, whatever checkout the panel itself was started from, because `new-worktree.sh` exits inside a linked worktree.
- Shows each worktree's ports, ahead/behind, working-tree changes, and the commits above a base ref. Each commit carries its own insertions and deletions, and the base commits sit below a divider so `origin/main` is always in reach. The header links the upstream branch on GitHub, and says `no upstream` rather than linking a local branch name that may not exist on the remote.
- The base ref is picked in the header and kept in `localStorage` per worktree. It sets both the commit list and what the workflow reviews, and clicking a remote badge in the commit list picks it too. The picker lists `origin` first, since the other remotes are forks.
- Renders diffs: click a commit for its own diff, shift-click a second one for the diff across that run of commits. The oldest commit's parent is the base, so a root commit diffs against git's empty tree.
- Runs the review-base workflow: `scripts/commit-after.sh <remote branch>` names the base commit, then the workflow archives any previous review and deletes `.scratch`. Claude reviews the commit through `/review-base` in a fresh session. A fresh Codex Astra session invokes `$review-followup assess .scratch/review/<sha>.json`, then resumes that session with `$review-followup apply`.

Codex runs with `--sandbox danger-full-access --ask-for-approval never exec --model gpt-6-astra --json` and the report schema in `codex-output.schema.json`. Its assessment and apply phases are separate nodes. Running the whole workflow includes applying fixes and rewriting commits under review-followup's rules; use the node buttons to pause after assessment. Required human actions, unresolved potential blockers, or unfinished fixes leave the job marked `needs-attention`, with the report explaining what remains. Independent fixes can still complete before that result.

After Astra finishes applying, the workflow backs up the committed local branch tip to `origin/draft/<local-branch>`, including rounds that still need human action. Uncommitted files remain local. Only a round with zero accepted findings and no required attention pushes the reviewed commit to the selected remote branch. A round that fixes findings needs a fresh review before that commit can be published. Later commits stay off the selected remote branch until their own clean review rounds.

Both pushes use explicit commit SHAs and leases captured before review. The draft may replace its previous history after amendments; the selected remote branch advances by exactly its reviewed child commit. If either destination changes during the review, its push fails. A changed local branch, a rewritten reviewed commit, or a base with multiple parents also prevents publication. These pushes never include tags or trigger submodule pushes.

Archives live under `${XDG_STATE_HOME:-~/.local/state}/alliance/agentic-review/<job-id>/`, outside the reviewed checkout by default. Each agent and push step saves its command, outcome, logs, transcript, worktree path, and reviewed commit SHA. Raw stdout is also saved as it arrives in `review.stdout.jsonl`, `assess.stdout.jsonl`, and `apply.stdout.jsonl`; each step's stderr goes to `<step>.stderr.log`. These files retain malformed lines and output received before cancellation. Push stdout uses `<step>.stdout.log`. The `review/` folder holds that round's review and assessment; `previous/` preserves review files found before clearing `.scratch`. Archive failures stop the workflow; a failure before clearing leaves `.scratch` intact. Archives are for later audits and are not included in agent prompts. Other `.scratch` files are not retained.

A job is an ordered list of steps, so the panel draws the nodes before the run starts, and `GET /api/workflow` returns those same nodes for a workflow nobody has run yet. Each node carries its own log and output, a failed step marks the rest skipped, and the node shows the exact argv once it spawns. Add a workflow by writing `StepDefinition[]` in `workflows.ts`; nothing in the page knows what the steps do.

The header's play button runs the whole workflow. The button on a node runs that one step and pauses, and it only ever appears on the next pending step, so steps cannot run out of order or twice. A paused job still holds its worktree; stop it to release it.

Clicking a node opens its modal: the full command, the log, the output, and the agent transcript. Claude's `stream-json` and Codex's `--json` emit events while the agent works. Every message is a row that opens on click, closed by default, carrying a one-line preview so a long transcript stays scannable. Open one for the parsed view, or toggle the raw object. Tool calls show their arguments as labelled fields for the tools in `TOOL_FIELDS`, and raw JSON for anything else. Transcripts are held in a side map and served by `GET /api/messages`, so the state the page polls every 1.5s stays small.

One job at a time per worktree, and one worktree script at a time across the repo. The panel refuses to remove the worktree it is running from, and refuses to remove a worktree with a job still running in it.

## Files

`server.ts` holds the routes. `src/` is the server: `worktrees.ts` reads git state, `diff.ts` runs and parses `git diff`, `jobs.ts` owns the job registry and subprocess logging, `workflows.ts` builds the three jobs. `ui/` is the React page.

Dependencies resolve from the repo root's `node_modules`, so this package declares none of its own.

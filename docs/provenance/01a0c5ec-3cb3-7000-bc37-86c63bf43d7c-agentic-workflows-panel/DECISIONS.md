# Decisions

## Shape of the thing

- **One Bun process.** `agentic-workflows/server.ts` serves the JSON API and bundles the React page through Bun's HTML import. No vite config, no build step, and the page hot-reloads while the server keeps its job list.
- **No dependencies of its own.** The package declares none and resolves react, lucide-react, react-markdown, react-query and zod from the repo root's `node_modules`. It is deliberately not a workspace member, so the rule in `AGENTS.md` about installing web dependencies from `apps/frontend/package.json` never comes up.
- **Port 6900,** overridable with `AGENTIC_WORKFLOWS_PORT`. Slots 0 to 12 claim 3005-4205, 5173-6373, 5174-6374 and 8085-9285, so 6900 collides with no worktree.
- **Scripts run in the main checkout.** `new-worktree.sh` exits inside a linked worktree, so the panel resolves the main root from `--git-common-dir` and spawns that copy of the script with the main root as the working directory, whatever checkout the panel itself was started from.
- **Worktrees are addressed by path, not name.** Two worktrees can produce the same stripped name, and every request validates its path against `git worktree list` before anything runs.
- **Nothing persists.** Jobs and transcripts live in memory; restarting the panel loses them. The alternative was a database for a tool one person runs on one machine.

## Safety rails

- **One job per lock.** The lock is the worktree path, or `repo` for the two worktree scripts, since `new-worktree.sh` picks a port slot and two runs would race for it.
- **The panel refuses to remove the worktree it is running from,** and refuses to remove any worktree with a job still running in it. `rm-worktree.sh`'s own guard reads `$PWD`, which is the main checkout here, so it would not catch either case.
- **Resolving the base runs before `rm -rf .scratch`.** A ref that does not resolve then costs nothing, where the earlier order deleted the previous run's findings before discovering the run could not start.
- **`rm -rf .scratch` runs only for review-base, not for the worktree scripts.** Those run with the main checkout as their working directory, so "each workflow" applied literally would delete the user's own `.scratch` every time they made a worktree. It is also its own node rather than a hidden side effect, so the card names the exact path and reports whether anything was there.

## Workflows as steps

- **A job is a declared `StepDefinition[]`,** which is what makes the graph drawable before the run starts. `GET /api/workflow` builds the same steps for a workflow nobody has run, so the page has one renderer for both.
- **A node shows a template until it spawns,** then the exact argv. The claude node reads `<base commit>` until the previous step resolves the SHA.
- **A failed step marks the rest skipped** rather than leaving them blank, and cancelling marks the live step canceled. The inline detail pane follows the step that actually ran, skipping over skipped ones.
- **The claude prompt is built literally** as the user wrote it, backticks included: ``/review-base base is `git show --stat <sha>` ``. The SHA is substituted; nothing else is reinterpreted.

## Stepping

- **`Paused` is a job status, not a flag.** A job is created with a `RunMode` of `all` or `step`; in `step` mode it runs one step and parks in `Paused`. The step definitions and the outputs map live in a side map keyed by job id, so the SHA resolved in one step still reaches the next one after the pause.
- **A paused job holds its worktree.** `ACTIVE` is a `Record<JobStatus, boolean>` used by both the lock check and the removal guard, so a paused job blocks a second review and blocks removing the worktree. Without that, "one workflow at a time per worktree" would have leaked.
- **Cancelling a paused job** marks its pending steps skipped and ends the job, since otherwise a paused job would hold the worktree with no process to kill.
- **Only the next pending step is runnable,** which is what the user allowed. The button renders on exactly one node, so out-of-order runs and re-runs are unrepresentable rather than validated.
- **The run button is a sibling of the node card, not nested inside it.** The card is a button that opens the modal, and a button inside a button is invalid HTML, so the run control is absolutely positioned over the card's corner.

## commit-after

- **`scripts/commit-after.sh` is a copy of the user's local `git-commit-after`,** kept in the repo so a fork can run the workflow. Its logic, exit codes and `ERROR[...]` messages are unchanged; only the usage line names the new path. It lives in `scripts/` rather than inside the panel because it is a general git utility, and `scripts/README.md` documents it.
- **The panel runs its own checkout's copy,** unlike `new-worktree.sh` and `rm-worktree.sh`, which must run from the main checkout. This script only needs the target worktree as its working directory, and the main checkout may be on a commit that predates the script.

## Claude output

- **`--output-format json` returns an array of messages, not one result object.** The first end-to-end run failed at the last step after nine minutes of real work because the parser expected an object. It now scans for the message with `type: "result"`.
- **Switched to `--output-format stream-json`.** `json` buffers the whole session until the process exits, so the modal had nothing to show while a review ran. `stream-json` prints one object per line as the agent works; each line is parsed and appended as it arrives. The final message is still the result, so the markdown output and the error path are unchanged.
- **Transcripts are kept in a side map** and served by `GET /api/messages`, not included in the state the page polls every 1.5 seconds. A review's transcript is hundreds of kilobytes.
- **Tool inputs render from a field table, not a switch.** `TOOL_FIELDS` maps a tool name to the fields worth reading, first one first: `Bash` to command then description, `Read` to file_path, `Grep` to pattern then path. The first field is also the row's preview, so a Bash call reads `Bash git show --stat 7da518db5`. Tool names are an open set, since MCP servers and plugins add their own, so an unknown tool falls back to the raw JSON rather than being an enum the build would have to keep exhaustive.
- **A closed message row carries a one-line preview,** built from the same parse as the body: the first line of assistant text, the tool's name for a tool call, the model and cwd for the init message, the stats for the result. Fifty rows reading only "assistant" would have been closed and useless.
- **The transcript renderer parses defensively.** Known shapes get a card each (system init, assistant text, tool calls with their input, tool results, the result with duration, turns and cost); anything unrecognised falls back to raw JSON rather than disappearing. Every card has a toggle for the raw object.

## Diffs

- **The unified diff is parsed by hand,** about sixty lines in `src/diff.ts`. `AGENTS.md` prefers a maintained package for parsing, and the deviation was flagged to the user. Adding `parse-diff` would have meant declaring a dev-tool dependency in `apps/frontend/package.json`, where it does not belong, to keep this package dependency-free. The alternative considered was `react-diff-viewer-continued`, already declared in the frontend, but it diffs whole file contents, which would have shipped entire files (including an 850KB lockfile) to the page instead of the changed hunks.
- **A range diffs from the oldest selected commit's parent to the newest.** Selection is a contiguous slice of the displayed list, so a range always has a single base. A root commit diffs against git's empty tree rather than failing on `^`.

## Commits list

- **Badges come from git's own decorations** (`%D`), so HEAD, the local branch and remote branches are labelled the way they are in `git log --decorate` rather than inferred.
- **The base commits sit below a divider.** The list is `base..HEAD`, which excludes the base itself, so the ref the user wants to select never appeared. The tip of the range base is appended, plus `origin/main` when the upstream is something else.
- **Insertions and deletions come from one `git log --shortstat` call,** not one call per commit.

## Base ref

- **One base ref per worktree drives both the commit list and the workflow.** Leaving the workflow with its own ref would have meant the list measured against the upstream while the review measured against something else.
- **It is a `<select>` over the worktree's real remote refs,** so an unresolvable ref cannot be typed. Bare remote symrefs (`origin`, `ljpurcell`) are dropped and `origin/*` sorts first, since the other remotes are forks and 150 entries buried it.
- **A stored ref that no longer resolves falls back** to the upstream, or `origin/main`, and the commits header shows the range actually used.
- **Stored in `localStorage` under `agentic-workflows:base:<worktree path>`.**
- **`suggestedRemote` was removed** from the detail payload once it became the same value as `base`.

## GitHub link

- **Only the upstream is linked.** A local branch name is not known to exist on the remote, so the header shows the upstream ref and links `/tree/<upstream branch>`, or renders `no upstream` as plain text. This deleted the earlier fallbacks: guessing the local branch, and linking `/commit/<sha>` for a detached head.

## Verification

- **End-to-end runs used a throwaway `panel-test` worktree,** created and removed through the panel itself, so a review agent running with `--dangerously-skip-permissions` could not touch a worktree someone was working in. That is what caught the message-array bug and the buffered-output problem.

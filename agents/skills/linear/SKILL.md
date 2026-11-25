---
name: linear
description: Read before starting or continuing work on an issue in Linear, our issue tracker, touching Linear, naming a branch for one of its issues, or naming one in chat, a commit or a PR.
---

# Linear API

OAuth client credentials are `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`. Run your script through `scripts/with-secrets.sh devtools <command>`, which sets them in that command's environment only. Your own shell expands `$LINEAR_CLIENT_ID` in the wrapped command line before the wrapper runs, so it sends an empty value, which Linear rejects as `invalid_client`. Read the variables inside a `.scratch/` script instead, and send the secret in the request body, never on a command line, where `ps` shows it. Not logged in → `docs/local-secrets.md`.

Linear accepts the `client_credentials` grant at `https://api.linear.app/oauth/token`, form-encoded.

Mint with at least `read` and `write`: `scope=read,write,...`

There is one team, `ALL` / Alliance.

A project's `description` holds at most 255 characters; its body goes in `content`.

A query may cost at most 10,000 complexity points, and each nested connection multiplies the cost by its page size, so a project's issues with their labels or relations can exceed it; a query that does gets under it with a small `first:` on each nested connection (`issues(first: 50) { nodes { labels(first: 10) { … } } }`). Page through with `pageInfo { hasNextPage endCursor }` rather than trusting one page to hold everything. For a label's issues, filter `issues` by `labels: {name: {eq: …}}` rather than traversing `issueLabels` → `issues`.

## Filing an issue

Before filing any issue, make sure it isn't already filed.

File it in the `Backlog` state.

Label it `AI-generated`, plus labels from every label group as each group's description says, plus any other relevant labels. The groups and their labels' descriptions: `issueLabels(filter: {isGroup: {eq: true}}) { nodes { name description children { nodes { name description } } } }`.

Write the description so the bug can be fixed from it alone, weeks later: repro, file paths with line numbers, and the branch and commit sha when the finding only exists on an unmerged branch.

## Starting work on an issue

Claim an issue before working on it, so two agents don't do the same work: move it to `In Progress` and comment your branch and session id (`claude:$CLAUDE_CODE_SESSION_ID` or `codex:$CODEX_THREAD_ID`). Every agent acts in Linear as the same `Alliance agent` user, so the session id is what tells claims apart, and it leads to the transcript of a session that stopped without a PR. A session continuing the claimant's work, through a handoff or as its subagent, works under that claim. When the issue already looks claimed by someone else, ask the user. If you drop the work without opening a PR, put the issue back as you found it.

## Referencing an issue

Wherever markdown renders, such as chat, PR descriptions and Linear comments, write an issue's key as a link so the reader can open it with one click: `[ALL-XXXX](https://linear.app/worldalliance/issue/ALL-XXXX)`. Linear resolves the URL without the title slug. The `Fixes` and `Part of` keys below stay bare, since the GitHub integration matches that text; link the issue elsewhere in the description. Commit messages render no markdown, so they keep bare keys.

## Linking work to an issue

The GitHub integration links through text: `Fixes ALL-XXXX` in the PR description attaches the PR, and in a commit message attaches the commit. Either completes the issue when the PR merges. Put one `Fixes` per issue in the description, and in the commit message when the issue already exists. An issue spanning several PRs gets `Part of ALL-XXXX` until the last one. An issue filed after its PR opened gets linked by editing the description.

List an issue the PR leaves open with no closing word (any tense of close, fix, resolve, complete or implement, or the phrase `linear issue`) directly before its key or earlier in the same list of keys: `filed instead of fixed: ALL-XXXX` in a PR description completed that unfixed issue at merge.

When the issue exists before the branch, prefer naming the branch `all-XXXX-<slug>`, which links the PR if the text is forgotten. Other branches carry no key, and a branch keeps the name it started with: GitHub closes the open PR of a renamed branch, and `scripts/rm-worktree.sh` loses track of one. A worktree name past 49 characters overflows Postgres's identifier limit on its test database, so pass a longer branch name with `--branch`.

---
name: linear
description: Read before touching Linear, our issue tracker, naming a branch for one of its issues, or writing a commit or PR that names one.
---

# Linear API

OAuth client credentials live in `.env.devtools` as `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`. Load them with `source .env.devtools`.

Linear accepts the `client_credentials` grant at `https://api.linear.app/oauth/token`, form-encoded.

Mint with at least `read` and `write`: `scope=read,write,...`

There is one team, `ALL` / Alliance.

To pull a label's issues, filter `issues` by `labels: {name: {eq: …}}`. Traversing `issueLabels` → `issues` exceeds Linear's query complexity limit.

## Filing an issue

Before filing any issue, make sure it isn't already filed.

File it in the `Backlog` state.

Label it `AI-generated`, plus labels from every label group as each group's description says, plus any other relevant labels. The groups and their labels' descriptions: `issueLabels(filter: {isGroup: {eq: true}}) { nodes { name description children { nodes { name description } } } }`.

Write the description so the bug can be fixed from it alone, weeks later: repro, file paths with line numbers, and the branch and commit sha when the finding only exists on an unmerged branch.

## Linking work to an issue

The GitHub integration links through text: `Fixes ALL-XXXX` in the PR description attaches the PR, and in a commit message attaches the commit. Either completes the issue when the PR merges. Put one `Fixes` per issue in the description, and in the commit message when the issue already exists. An issue spanning several PRs gets `Part of ALL-XXXX` until the last one. An issue filed after its PR opened gets linked by editing the description.

List an issue the PR leaves open with no closing word (any tense of close, fix, resolve, complete or implement, or the phrase `linear issue`) directly before its key or earlier in the same list of keys: `filed instead of fixed: ALL-XXXX` in a PR description completed that unfixed issue at merge.

When the issue exists before the branch, prefer naming the branch `all-XXXX-<slug>`, which links the PR if the text is forgotten. Other branches carry no key, and a branch keeps the name it started with: GitHub closes the open PR of a renamed branch, and `scripts/rm-worktree.sh` loses track of one. A worktree name past 49 characters overflows Postgres's identifier limit on its test database, so pass a longer branch name with `--branch`.

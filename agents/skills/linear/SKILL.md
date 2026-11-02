---
name: linear
description: Read before touching Linear, our issue tracker.
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

## Closing an issue

The GitHub integration is live: a commit on `main` whose message contains `Fixes ALL-XXXX` auto-completes the issue, and a branch name containing the key (`all-XXXX-…`) moves it to In Progress.

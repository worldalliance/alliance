---
name: linear
description: Read before touching Linear, our issue tracker.
---

# Linear API

OAuth client credentials live in `.env.devtools` as `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`. This holds sensitive information, handle it like you would other .env files.

Linear accepts the `client_credentials` grant at `https://api.linear.app/oauth/token`, form-encoded, so those two are the whole story: no browser redirect to drive, no personal API key to go ask for.

Mint with at least `read` and `write`: `scope=read,write,...`

There is one team, `ALL` / Alliance.

## Filing an issue

Label it `AI-generated`, in addition to any other relevant labels.

Write the description so the bug can be fixed from it alone, weeks later: repro, file paths with line numbers, and the branch and commit sha when the finding only exists on an unmerged branch.

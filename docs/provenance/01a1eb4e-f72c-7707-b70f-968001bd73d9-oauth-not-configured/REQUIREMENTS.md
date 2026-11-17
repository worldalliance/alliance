---
user: Charles Lien
task: Fix ALL-2216 minimally (say clearly when Google or Apple sign-in isn't set up on the server), as a PR from the envvars branch.
---

# Requirements

1. When the server has no Google or Apple sign-in configured (contributor mode, `ALLIANCE_WITHOUT_TEAM_SECRETS`), sign-in says so instead of failing with a raw 503 or a "please try again" that can't succeed. User-originated (ALL-2216).
2. Keep it minimal. Covered: web and Kora `GET …/start`, which send the person back to the page they came from with the error, and the mobile native id-token endpoints (`POST /auth/:provider/native` and `/link/native`), which return the error through the `error` field they already have. Not covered: `native/browser` and `link/browser`, whose response shape stays as it is. Agent-proposed, user-approved.
3. Out of scope: hiding unconfigured providers, verifying native tokens without the provider secret, and changing the browser-session response shape. User-originated ("too many features").

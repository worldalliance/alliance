---
user: Charles Lien
task: Fix ALL-1063, the verify-email page stuck on "Verifying email..."
---

## Task

The user asked the agent to find an easy Linear issue. The agent proposed ALL-1063 (the verify-email page says "Verifying email..." forever when the link fails, with ALL-1089 as a duplicate) and asked whether to start. The user said:

> yes

## Status code for a dead link

The agent reported that a 401 from `POST /user/verifyEmail` makes the web client refresh the session and then sign the member out and redirect to `/login`, so the page's error would never show. It proposed three options: return 400 from the server, exempt the endpoint from the client's 401 handling, or fix only the page. The user asked:

> which of these is the best long-term solution?

The agent recommended returning 400, keeping `verifyEmail` in this change and leaving password reset (which also returns 401) to ALL-1090. The user said:

> ok go with that

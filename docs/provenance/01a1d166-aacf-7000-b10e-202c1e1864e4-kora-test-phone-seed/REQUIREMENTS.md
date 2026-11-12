---
user: Alex Dorey
task: Write a script that generates 1000 Kora waitlist members who can sign in with phone numbers +1415555XXXX, bypassing the confirmation step or accepting a fake code. Only ever run locally or on staging.
---

# Requirements

- A script creates 1000 Kora waitlist participants with phone numbers +14155550000 to +14155550999. (user-originated)
- It runs only locally or on staging, and refuses to run when `NODE_ENV` is production. (user-originated; refusal agent-proposed, user-approved)
- It is a server script in `server/scripts/` using the app's data source, run with `bun` locally and on the staging host through `secrets_run.sh`. (agent-proposed, user-approved)
- Each participant is plainly signed up: phone verified, a synthetic name, no reviewer row, not yet notified. (agent-proposed, user-approved)
- Re-running the script is safe, and a `--delete` flag removes every +1415555XXXX participant along with what cascades from them. (agent-proposed, user-approved)
- Outside production, sign-in for +1415555XXXX numbers sends no text and accepts the code `000000`; any other code is refused as a wrong code. (agent-proposed, user-approved)
- Outside production, +1415555XXXX numbers are exempt from the one-time code rate limits, so an automated run can sign in all 1000 from one machine. Real numbers keep their limits. (agent-proposed, user-approved)

---
user: Charles Lien
task: Scrub the remaining real contact details from staging so it can send notifications
---

# Requirements

- Staging sends notifications (email, SMS), so Kora sign-in codes reach the address the participant enters on staging. (user)
- The prod → staging sync scrubs every real email address and phone number copied from prod, including waitlist emails. Names and other personal text stay out of scope. (user)
- Organization and government addresses (such as `@worldalliance.org`, city `.gov` contacts in form schemas, assigned rows, and editable content) are published contacts and stay as they are. (agent-proposed, user-approved)
- The mail service sends nothing to the `@example.com` addresses the sync writes in place of real ones, as SMS already skips the `+1555` numbers. (agent-proposed, user-approved)
- The staging deploy passes `SEND_DEV_NOTIFS` from the staging GitHub environment's `SEND_DEV_NOTIFS` variable, which the user sets to `1`. It is a variable, not a secret. (agent-proposed, user-approved)
- Staging's `MAIL_FROM` variable is a copy of production's. (agent-proposed, user-approved)
- Rollout: merge and deploy with `SEND_DEV_NOTIFS` unset, run the updated sync, then set the variable to `1` and redeploy, so staging never sends while it still holds real contact details. (agent-proposed, user-approved)
- The user runs the updated sync against staging after merging; the change itself writes nothing to staging. (user)
- How real contact details inside free text are scrubbed is the agent's choice. (deferred)

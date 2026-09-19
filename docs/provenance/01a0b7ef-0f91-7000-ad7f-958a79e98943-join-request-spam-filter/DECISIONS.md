# Decisions

- **Heuristic.** A request counts as spam only when both the name and the reason are one token of 12+ ASCII letters with at least 3 uppercase letters after the first character. Requiring both fields means a real person with an odd name or a one-word reason still reaches alerts. The limits are tuned to the four samples the user pasted and will need changing if the bot changes its output.
- **Spam is still recorded.** The event-log row and the admin panel entry stay the same. The only change is which webhook gets the Slack post.
- **Channel selection.** `EventLogMessage` has an optional `slackChannel` field (`SlackChannel` enum, `Record` from channel to env var name) that defaults to alerts, so other callers don't change.
- **Missing firehose URL.** If the env var is unset, the service logs a warning and skips the Slack post, the same way it already handles a missing `SLACK_WEBHOOK_URL`. It doesn't fall back to alerts.
- **Deploy.** `deploy.yaml` exports `SLACK_FIREHOSE_WEBHOOK_URL` from secrets next to `SLACK_WEBHOOK_URL`. The staging deploy reads the same secret, but staging doesn't post to Slack because `NODE_ENV` isn't `production` there.

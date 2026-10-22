---
user: Charles Lien
task: Route spam join requests away from the alerts Slack channel
---

# Requirements

- The alerts Slack channel gets flooded with join requests the user believes come from an email-bombing attack aimed at someone else. Example: name `MBGWGqqOHmaCfjjXBopsKO`, reason `biJrcBSgyHNPuKeQHjlts`, with a real-looking yahoo.com address.
- Send those requests to the existing firehose Slack channel instead of alerts.
- Use a regex for now, not an LLM. (The agent offered both options and the user picked the regex.)
- The user added `SLACK_FIREHOSE_WEBHOOK_URL` to the GitHub environment secrets.

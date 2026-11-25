---
user: Charles Lien
task: Implement ALL-2151 in a PR from the `domain` worktree, so the inbound MMS Twilio signature check stops accepting the worldalliance.org webhook URL
---

- The inbound MMS Twilio signature check accepts only a signature valid for the webhook URL built from `APP_URL` (`twilioWebhookUrl()`), which is thealliance.org in production and staging since the cutover. A signature for the `ALT_APP_URL` (worldalliance.org) URL is rejected. This is the contract step for `01a1cd4c-60a2-76b5-8d19-aa7dacafa2c4-twilio-both-webhook-urls`, whose dual-URL requirement it supersedes. (agent-proposed in `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move` and ALL-2151, user-approved)
- `ALT_APP_URL` stays; its other readers go in ALL-2154. (agent-proposed, user-approved)
- The work happens on the `domain` branch. (user-originated)

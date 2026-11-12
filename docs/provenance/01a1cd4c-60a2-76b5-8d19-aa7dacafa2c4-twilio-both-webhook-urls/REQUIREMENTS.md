---
user: Charles Lien
task: Implement ALL-2137, so the Twilio signature check accepts both the worldalliance.org and thealliance.org webhook URLs
---

- The inbound MMS Twilio signature check accepts a signature valid for the webhook URL on worldalliance.org or on thealliance.org, in production and staging, so inbound MMS keeps verifying while `APP_URL` and the Twilio console move between domains at different moments. This is the expand step of expand-migrate-contract; ALL-2151 is its contract step. (agent-proposed in `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move` and ALL-2137, user-approved)
- The work happens on the `domain` branch. (user-originated)

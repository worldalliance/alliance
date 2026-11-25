---
user: Charles Lien
task: Fix ALL-2142 (mobile calls the API and analytics on thealliance.org) on the `domain` branch, then open a PR
---

- Implement Linear issue ALL-2142, "Mobile: call the API and analytics on thealliance.org", on the `domain` branch, and open a pull request for it. (user-originated)
- The mobile app's production and staging API and analytics hosts move to thealliance.org through an OTA update and the next binary; the legacy API keeps serving until no traffic comes from builds older than this change. Carried over from `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move`. (agent-proposed, user-approved)

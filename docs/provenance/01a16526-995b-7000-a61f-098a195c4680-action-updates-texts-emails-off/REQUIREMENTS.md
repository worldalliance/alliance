---
user: Alex Dorey
task: Turn off action update texts and emails
---

# Requirements

- Members stop getting "Action updates" by text (MMS) and by email. Push and in-app stay as they are. (user)
- Only "Action updates" changes; other kinds turned on automatically this month stay as they are. (agent-proposed, user-approved)
- A member who chose an "Action updates" text or email setting themselves keeps it. (agent-proposed, user-approved)
- A script applies the change to existing accounts on staging. It reaches staging over SSH, as `scripts/download_staging_data.sh` does, and takes the host and env file as overrides so it can run against prod later. It changes nothing unless told to apply. (user; host override and dry run agent-proposed, user-approved)
- Accounts created from now on start with "Action updates" texts and emails off. (agent-proposed, user-approved)

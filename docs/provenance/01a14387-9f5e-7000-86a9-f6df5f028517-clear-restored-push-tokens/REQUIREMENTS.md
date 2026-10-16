---
user: Charles Lien
task: Stop local servers running on restored staging data from sending pushes to real devices
---

- A device registered on the staging app must not receive badge (or other) pushes from a local dev server whose database was restored from a staging dump. (user)
- Restoring a staging dump locally clears every `user_device."expoPushToken"`, the same `user_device` pruning `scripts/sync_prod_to_staging.sh` applies when it copies prod into staging. (agent-proposed, user-approved)
- The push tokens already present in existing local databases are cleared once, by hand, outside the change. (agent-proposed, user-approved)

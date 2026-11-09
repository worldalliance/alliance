---
user: Charles Lien
task: Put the staging host's hand-set crontab entry for the prod → staging sync in the repo, choosing the mechanism from research into established practice.
---

# Requirements

- The schedule of the nightly prod → staging sync lives in the repository and the deploy puts it on the staging host, in place of the hand-set crontab entry `30 10 * * * /home/ec2-user/sync_prod_to_staging.sh >> /home/ec2-user/sync_prod_to_staging.log 2>&1`. (user-originated)
- The mechanism is a committed systemd service and timer installed by the deploy. (agent-proposed, user-approved)

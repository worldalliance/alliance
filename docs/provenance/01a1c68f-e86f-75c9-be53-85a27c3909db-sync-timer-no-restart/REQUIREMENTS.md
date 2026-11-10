---
user: Charles Lien
task: Fix the staging deploy starting an extra prod → staging sync (ALL-2107), and open a PR.
---

# Requirements

- A staging deploy never causes a prod → staging sync beyond the day's one run in the five minutes after its scheduled 10:30 UTC time. A deploy-started run inside that window, on a day with no run yet, stands in for that day's sync. (agent-proposed, user-approved)
- The deploy installs the sync's service and timer without restarting the timer: it runs `daemon-reload`, then `enable --now`. (agent-proposed, user-approved)
- The deploy no longer removes the sync from `ec2-user`'s crontab. This is the `BACKCOMPAT(sync-timer)` contract step from `01a1c193-c5d8-7000-8a5b-cc1cba80460c-sync-systemd-timer`. (agent-proposed, user-approved)

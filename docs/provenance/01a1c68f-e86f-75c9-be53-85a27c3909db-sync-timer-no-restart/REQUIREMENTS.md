---
user: Charles Lien
task: Fix the staging deploy starting an extra prod → staging sync (ALL-2107), and open a PR.
---

# Requirements

- A staging deploy never starts the prod → staging sync. The sync runs only on its 10:30 UTC schedule. (user-originated)
- The deploy installs the sync's service and timer without restarting the timer: it runs `daemon-reload`, then `enable --now`. (agent-proposed, user-approved)

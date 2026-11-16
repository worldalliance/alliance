---
user: Charles Lien
task: Let a fresh clone without team credentials boot the server in development (Linear ALL-2086), in one PR
---

# Requirements

- Someone without the team's credentials, such as an outside contributor, can boot the server in development from a fresh clone. (Linear ALL-2086, user-approved)
- A team member who is missing a key still gets the startup validation error naming it. (Linear ALL-2086, user-approved)
- Running without the team's secrets is an explicit opt-in, and each integration then behaves in a defined way rather than keys being silently absent. (Linear ALL-2086, user-approved)
- The contributor setup is documented. (Linear ALL-2086, user-approved)
- The work is one PR, and merging it fixes ALL-2086. (user-originated)

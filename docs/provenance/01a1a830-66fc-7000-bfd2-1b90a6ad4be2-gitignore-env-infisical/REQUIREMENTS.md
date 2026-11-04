---
user: sidsquid
task: Unblock the GitHub push of main that secret scanning rejected
---

# Requirements

- Remove `server/.env.infisical` from the unpushed commit GitHub blocked, so the branch can be pushed without using GitHub's "allow this secret" links. (user-originated)
- Ignore `server/.env.infisical` so it is not committed again. (user-originated)

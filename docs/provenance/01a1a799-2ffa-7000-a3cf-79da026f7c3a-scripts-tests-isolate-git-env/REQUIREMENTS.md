---
user: Charles Lien
task: Prevent a recurrence of the incident that broke git in the main checkout
---

# Requirements

- Make sure the incident of 2026-11-04 cannot happen again. In it, five commits titled `init` by `test <test@example.com>` landed on the main checkout's `main` branch, and `core.bare = true` was written to the main checkout's `.git/config`, so every git command there failed with `fatal: this operation must be run in a work tree`. (user)

---
user: Charles Lien
task: Check in CI that dirty.txt exists
---

- `dirty.txt` is meant to always exist at the repo root; whether it is empty is the production deploy gate. Its deletion in `619d5fd61` was believed accidental.
- Make CI check that `dirty.txt` exists.
- The content check should fail production only; the existence check should fail changes to `main`.

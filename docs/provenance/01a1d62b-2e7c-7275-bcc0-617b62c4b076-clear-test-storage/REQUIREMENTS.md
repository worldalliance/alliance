---
user: Charles Lien
task: Fix the CI failure on main after #985
---

- Unit tests stop failing depending on test file order: browser storage one test file leaves behind must not reach later test files. (user-originated: fix the CI failure)

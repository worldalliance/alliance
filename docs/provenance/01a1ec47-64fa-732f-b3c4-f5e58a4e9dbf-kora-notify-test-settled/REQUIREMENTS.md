---
user: Charles Lien
task: Fix the flaky Kora launch notice e2e test ("leaves a failed delivery for the next send") and open a PR.
---

- The Kora launch notice e2e tests wait until the background send has finished before asserting what was sent, so they pass regardless of timing. (user-originated)

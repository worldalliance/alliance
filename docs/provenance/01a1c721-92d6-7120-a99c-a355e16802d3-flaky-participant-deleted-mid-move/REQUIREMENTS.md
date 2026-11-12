---
user: Charles Lien
task: Fix the failing CI from ALL-2116 and open a PR.
---

- The e2e test "Chat updates to a row deleted after its load (e2e) › a chat participant deleted after a write loads it › stays deleted through a move that rejoins the member" in `server/test/live-row-updates-messaging.e2e-spec.ts` passes reliably in CI. (user-originated)
- The fix lands as a PR. (user-originated)

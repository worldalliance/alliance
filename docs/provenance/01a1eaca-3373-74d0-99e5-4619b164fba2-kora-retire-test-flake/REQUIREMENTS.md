---
user: Charles Lien
task: CI is failing on a flaky test; fix it and open a PR.
---

# Requirements

1. The `Kora batch retire, reactivate and delete (e2e) > retires a batch: unrated pairs leave, new assignments skip it, and reactivating brings it back` test in `server/test/kora-batch-actions.e2e-spec.ts`, which failed CI on `main` (run 44146162260), passes deterministically. (user-originated)
2. The fix ships as a PR against `main`. (user-originated)

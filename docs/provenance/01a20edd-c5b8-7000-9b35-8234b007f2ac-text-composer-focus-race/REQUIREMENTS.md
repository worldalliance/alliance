---
user: Charles Lien
task: Fix the flaky test that failed main's CI after PR 1063, and open a PR for it.
---

# Requirements

- Fix the flaky admin unit test "keeps the text and asks again when newer texts arrived while writing" in `apps/admin/src/components/texts/TextComposer.test.tsx`, which failed main's Deploy run after PR 1063 merged. (user-originated)
- File a Linear issue for it before starting the implementation: ALL-2457. (user-originated)
- Open a PR with the fix. (user-originated)

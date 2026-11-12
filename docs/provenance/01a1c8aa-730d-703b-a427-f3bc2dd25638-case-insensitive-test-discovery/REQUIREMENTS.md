---
user: Charles Lien
task: Pick one of the AI-generated flaky test issues in Linear, fix it, and open a PR.
---

- Fix an AI-generated issue from Linear and open a PR with the fix. (user-originated)
- Close ALL-1953 (intermittent `bun test` hang in `scripts/`) as not reproducible on `main`, and fix ALL-2091 instead: `scripts/test-all.sh` and `BUN_TEST_FILE` miss test files that bun discovers with uppercase names. (agent-proposed, user-approved)

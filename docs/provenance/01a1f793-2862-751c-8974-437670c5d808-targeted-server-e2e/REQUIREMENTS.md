---
user: Charles Lien
task: Server e2e tests time out locally and slow development; look at agent transcripts to find out why, then fix what local checks run.
---

# Requirements

- Local checks skip server e2e when a change touches nothing under `server/`, `common/` or `kora-review/`, and otherwise run only the server e2e suites that cover the changed code. The full server e2e run happens only in CI. (agent-proposed, user-approved)
- Nothing caps how many server e2e runs happen at once across worktrees, neither a machine-wide lock nor admission by load average. (user-originated)
- Any change to the root `bun.lock` counts as touching the server for the rule above. Locally it runs the server typecheck and `server/test/health-db.e2e-spec.ts`, plus the suites covering any other changed server code, and leaves the rest of the server e2e set to CI. (agent-proposed, user-approved)
- This PR ships with Claude reviews only: the Codex reviewer was unavailable (usage limit) during its review loop, and the PR says Codex didn't review it. (agent-proposed, user-approved)

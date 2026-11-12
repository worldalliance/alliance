---
user: Charles Lien
task: Pick the next issue in the Faster CI deploys Linear project (ALL-2163, split backend e2e tests into 4 shards and record per-file timings) and open a PR for it from the `ci` branch.
---

# Requirements

This is the second planned PR of the spec in `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. Its "Backend e2e tests" requirements, already approved by the user, govern; restated here:

- The backend e2e suite runs as 4 shards using Bun's default `bun test --shard=i/4`, split by sorted file name. Each shard is its own job with its own Postgres (approved, agent proposal, in that spec).
- No timings file and no automated PRs refreshing one; Bun's `--timings` option is not used (user, in that spec).
- Each shard job logs its CPU model, runner image and Bun version, and uploads its per-file timings (approved, research recommendation, in that spec).
- The work ships as one PR from the existing `ci` branch (user).

# Evidence

## Research

### `queue` support

Question: do GitHub Actions and actionlint accept `queue: max` in a `concurrency` block? Checked 2026-11-14.

- **GitHub accepts `queue: single` (default) or `queue: max`.** `max` keeps up to 100 pending jobs or runs per group; once the queue is full, further ones are cancelled. It can't be combined with `cancel-in-progress: true`. Pending members start in order of when each began waiting, which "is not guaranteed". Vendor documentation, read in its source: https://github.com/github/docs/blob/main/data/reusables/actions/actions-group-concurrency.md, https://github.com/github/docs/blob/main/content/actions/reference/limits.md
- **actionlint 1.7.12, the newest release, rejects the key** with `unexpected key "queue" for "concurrency" section`. Support is requested in open issues https://github.com/rhysd/actionlint/issues/654 and https://github.com/rhysd/actionlint/issues/657. Maintainer's issue tracker.

### Concurrency group names

Question: are `Deploy-staging` (the old workflow-level group) and `deploy-staging` one group? Checked 2026-11-14.

- **Yes.** "The concurrency group name is case insensitive. For example, `prod` and `Prod` will be treated as the same concurrency group." Vendor documentation: https://github.com/github/docs/blob/main/data/reusables/actions/actions-group-concurrency.md

## Measurements

### Job names of a called workflow

Method: `gh api repos/worldalliance/alliance/actions/runs/43479797083/attempts/1/jobs`, a Deploy run of `main` whose checks failed, on 2026-11-14.

- Jobs of a called workflow are listed as `<calling job> / <job>`, such as `test-backend-e2e / test-backend-e2e (shard 1/4)` and `mobile-bundle-check / mobile-bundle-check`.
- A calling job that was skipped is listed once under its own name: `publish-mobile-ota | skipped`.

Run 43470994791, a cancelled Deploy run, lists no jobs.

### Deployments Actions creates

Method: `gh api "repos/worldalliance/alliance/deployments?environment=<name>"` for `staging`, `staging-hosts` and `staging-live`, and `gh api repos/worldalliance/alliance/environments`, on 2026-11-14.

- `staging` and `staging-hosts` each held several deployments of `ef824fe410`, minutes apart, task `deploy`: one per job of the run naming that environment.
- `staging-live` held none, and the repository's environments were `pr-screenshots`, `production`, `production-hosts`, `staging` and `staging-hosts`.

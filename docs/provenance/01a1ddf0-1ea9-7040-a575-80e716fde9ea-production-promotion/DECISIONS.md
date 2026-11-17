# Decisions

Decisions carried from `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed/DECISIONS.md` and implemented here: the freeze check checks out the deployed commit by SHA before any deploy job.

## Shape

- **The checks and builds moved from `deploy.yaml` into `deploy-checks.yaml`.** Every deploy that runs the checks calls it. This also advances ALL-2012's split of `deploy.yaml`. Its `dirty-check` always runs in `exists` mode: production's `empty` check moved into the deploy. Origin: agent decision.
- **`deployed-config` and `upload-react-sourcemaps` moved into `deploy-environment.yaml`.** A deploy the guard skips uploads nothing. They run under the lock. The guard waits for `deployed-config`, so a config failure deploys nothing and opens no record, as when `deploy` needed it; that adds its run, about a `bun install`, to every deploy. The source map upload waits for the guard and runs alongside the deploys. A hung job would otherwise hold the lock, so `deployed-config` times out after 10 minutes and the upload after 15. Every step of the upload continues on error, not the job, and each step has a timeout, 13 minutes together, within the job's 15: GitHub doesn't document whether a failed job inside a called workflow fails the calling job, which would make Deploy alert on a deploy that succeeded. A failed upload shows as an annotation on the run. This supersedes the deploy-lock task's decision that `deploy.yaml` keeps them. Origin: agent decision.
- **`deploy-environment.yaml` downloads another run's artifacts by the ids its caller passes, not by name.** A name reads the newest artifact of that name, which a re-run of the other run after its ids were checked may have replaced; by id, a replaced artifact fails the download. Origin: agent decision.
- **A deploy's details go in its deployment record's payload.** The record already belongs to the deploy, so the details stay with it without another store. Origin: agent decision implementing "records the artifact IDs".

## Rollout

- **This PR leaves the CI environments' settings, such as `production-hosts`' deployment branch rule, manual; ALL-2294 moves the five CI environments into `terraform/`.** The user chose to manage them with the GitHub provider, branch rules derived from `local.ci_roles[*].trust`, applied by hand and never from CI, as separate work, so that choice is ALL-2294's requirement rather than this PR's. Never from CI because environment and branch-policy writes need repository Administration write, which `GITHUB_TOKEN` can't be granted. Origin: user choice, asked in review.

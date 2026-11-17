# Decisions

## Shape

- **The checks and builds moved from `deploy.yaml` into `deploy-checks.yaml`.** Every deploy that runs the checks calls it. This also advances ALL-2012's split of `deploy.yaml`. Origin: agent decision.

## Rollout

- **This PR leaves the CI environments' settings, such as `production-hosts`' deployment branch rule, manual; ALL-2294 moves the five CI environments into `terraform/`.** The user chose to manage them with the GitHub provider, branch rules derived from `local.ci_roles[*].trust`, applied by hand and never from CI, as separate work, so that choice is ALL-2294's requirement rather than this PR's. Never from CI because environment and branch-policy writes need repository Administration write, which `GITHUB_TOKEN` can't be granted. Origin: user choice, asked in review.

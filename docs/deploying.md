# Deploying

Every push to `main` deploys to staging through `.github/workflows/deploy.yaml`: the checks and builds, then the deploy and smoke checks under the staging lock.

## Production

```bash
git push origin main:production
```

Every push to `production` deploys its commit, whether a push of `main`, a cherry-pick or revert committed on `production`, or a force-push.

When the commit's newest staging run is fully green, meaning its checks and builds, its backend, frontend and admin deploys, and its smoke checks all passed, re-runs included, the production run doesn't re-run the checks. It deploys that run's frontend and admin builds, which staging keeps for 90 days, and its summary names the staging run and the artifacts.

Otherwise the production run checks and builds the commit itself, then deploys it if every check passed; its summary says why. That covers a commit with no staging run, such as one made on `production`, one whose staging run failed or whose builds expired, and one whose staging run is still going, which it doesn't wait for. Reusing staging's builds takes about 3 minutes, building about 9. A failed production run alerts the deployment Slack channel either way.

A production deploy stops when the commit's `dirty.txt` has content, which freezes releases until the manual work it lists is done. When a newer push moves `production` before a run's deploy starts, that run skips its deploy and the newer one deploys.

- **Hotfix:** land the fix on `main` and push `main` to `production` (`git push origin main:production`). If `main` holds unreleased work, cherry-pick the fix onto `production` and push that. `production` then holds a commit `main` lacks, so once `main` has the fix too, the next push needs `git push --force origin main:production`.
- **Rollback:** revert the bad commit on `production` and push, or force-push `production` to the commit that was live before; the `production-live` environment's deployments list it. A push deploys through its commit's own `deploy.yaml`, so an older commit deploys the way it did then. Migrations don't roll back, so the commit's code must also work with the migrations production has already run. A commit that re-checks stored formulas on deploy refuses to start, and keeps the running release, when a formula saved since uses something it lacks; the deploy log names each one. Edit or delete those formulas in admin first, or revert only the commit that broke things.

---
user: Charles Lien
task: Work on ALL-2166 of the Faster CI deploys Linear project (promote fully green staging runs to production, with an override and reconcile step) and open its PR from the `ci` branch.
---

# Requirements

This is the fifth and last PR planned by `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. Its requirements are that task's "Production promotion" section, approved there by the user, restated below with their origin labels, except where "Any push to production deploys" supersedes them.

## Promotion

- **A production push skips the checks when staging is fully green.** When `git push origin main:production` pushes a commit whose staging deploy run is fully green, the production run skips re-running the checks and deploys the artifacts that staging run built (approved, research recommendation).
- **"Fully green" means a named list of required jobs all `success`** (approved, research recommendation):
  - The jobs are read from the newest staging `deploy.yaml` run for that commit, through the jobs API with `filter=latest`.
  - The required list is the checks, the builds, the backend, frontend and admin deploys, and the `verify-*` smoke checks.
  - The list is defined once. The staging deploy gates on its checks-and-builds part; promotion uses the whole list.
  - Results carried forward from earlier attempts of the run count. The production run records the artifact IDs and the deployed commit it relied on.
  - A staging deploy that skipped itself shows as skipped and never counts.
- **Not on the required list:** `publish-mobile-ota`, whose failure still alerts Slack (approved, agent debate); `upload-react-sourcemaps` and `notify` (approved, research recommendation).
- **Every production deploy checks the production freeze** (approved, agent proposal), extending `docs/provenance/01a0fa1c-240a-7000-9cc2-720383b4769d-dirty-txt-existence-check`:
  - promoted deploys and deploys that build themselves alike check `dirty.txt` on the deployed commit and stop if it has content;
  - the check checks out the deployed commit explicitly;
  - the freeze is commit-specific: content added on `main` doesn't freeze an older commit whose `dirty.txt` is empty.
  - in an emergency, the hotfix commit clears only the entries whose manual work is done or isn't part of that release (approved, Codex second opinion).

## Any push to production deploys

This section supersedes these requirements of `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`: "Without a fully green staging run, production waits or refuses", "The refusal names what to push instead", and every requirement on the override and the reconcile step, including that the override moves the `production` branch, that the reconcile step force-updates it, and that both start from `main`. With them gone, the `production-hosts` role and environment admit only `refs/heads/production` again, as `docs/provenance/01a1ae09-099d-7000-b383-f96896027c92-ci-oidc-parameter-store` requires (user).

- **Any push to `production` deploys its commit correctly**, whether a normal push, a cherry-pick or revert made on `production`, or a force-push (user).
- **Without a fully green staging run, the production run builds itself** (user, choosing among agent proposals). Whether the commit's staging run failed, never existed, or is still in progress, the production run immediately runs the full checks and builds itself, and deploys if they pass. It doesn't wait for a staging run in progress. A commit whose staging run is fully green, with unexpired artifacts, still reuses them.
- **The production freeze still refuses, and a newer push still supersedes** (user).
- **A production run that builds itself and fails alerts like any failed production deploy;** it never reads as superseded (user).
- **There is no override, override block or reconcile step** (user). An emergency is a push to `production`; a rollback is a revert or a force-push. The deployment records other code reads stay, such as the live commit `publish-mobile-ota.yaml` reads.
- **A push deploys whether or not it descends from the commit live on production** (user). A force-push to a commit from before this change deploys through that commit's own pipeline.
- **`docs/deploying.md` and `docs/ci-secrets.md` describe this behaviour** (user).

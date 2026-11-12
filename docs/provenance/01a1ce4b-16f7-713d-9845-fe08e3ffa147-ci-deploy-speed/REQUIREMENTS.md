---
user: Charles Lien
task: Research the industry standard for CI/CD, since employees complain that CI takes too long to deploy to production, and specify the changes that follow from it.
---

# Requirements

Origin labels: **user** means user-originated. **approved (source)** means agent-proposed and user-approved, with the source of the proposal named.

The complaint is about pipeline duration: the roughly 15-minute staging and production deploy runs and the PR CI run. The time between merging to `main` and someone running `git push origin main:production` is out of scope; that push is manual and happens whenever the team chooses (user).

## Scope

The change covers four parts (approved, from a research and timing audit by agents):

1. Production deploys reuse the verification staging already did. This part includes the override workflow and its reconcile step, the production freeze check on every production deploy, environment-neutral web bundles with runtime config, and the mobile bundle check.
2. Backend e2e tests run in parallel shards.
3. Checks run outside the deploy lock.
4. The e2e duration variance is instrumented.

All visual regression is deleted (user).

## Production promotion

- **A production push skips the checks when staging is fully green.** When `git push origin main:production` pushes a commit whose staging deploy run is fully green, the production run skips re-running the checks and deploys the artifacts that staging run built (approved, research recommendation).
- **"Fully green" means a named list of required jobs all `success`** (approved, research recommendation):
  - The jobs are read from the newest staging `deploy.yaml` run for that commit, through the jobs API with `filter=latest`.
  - The required list is the checks, the builds, the backend, frontend and admin deploys, and the `verify-*` smoke checks.
  - The list is defined once. The staging deploy gates on its checks-and-builds part; promotion uses the whole list.
  - Results carried forward from earlier attempts of the run count. The production run records the artifact IDs and the deployed commit it relied on.
  - A staging deploy that skipped itself (see "Deploy concurrency") shows as skipped and never counts.
- **These jobs are not on the required list:**
  - `publish-mobile-ota` (approved, agent debate). Its failure still alerts Slack.
  - `upload-react-sourcemaps` and `notify` (approved, research recommendation).
- **Without a fully green staging run, production waits or refuses** (approved, research recommendation).
  - If a staging run for the commit is in progress, the production run waits for it, for at most about 60 minutes, then re-checks.
  - Otherwise it refuses to deploy, and its message says why.
- **The refusal names what to push instead** (approved, agent proposal):
  - It names a replacement commit that is fully green, fast-forwards from the current `production` branch, has unexpired artifacts, and passes the production freeze.
  - If no commit qualifies, it names the staging run to wait for.
  - It mentions the override only for urgent cases.
  - Production never deploys a commit nobody named: the replacement is only suggested.
- **Every production deploy checks the production freeze** (approved, agent proposal). This extends the requirement in `docs/provenance/01a0fa1c-240a-7000-9cc2-720383b4769d-dirty-txt-existence-check` that the `dirty.txt` content check fails production:
  - Promoted and override deploys alike check `dirty.txt` on the deployed commit and stop if it has content.
  - The check checks out the deployed commit explicitly, since a dispatched run's default checkout is the dispatch ref.
  - The freeze is commit-specific: content added on `main` doesn't freeze an older commit whose `dirty.txt` is empty.
  - In an emergency, the hotfix commit clears only the entries whose manual work is done or isn't part of that release (approved, Codex second opinion).
- **An override workflow handles emergencies.** It is started by hand with a commit and a reason, runs the full checks, builds, and deploys that commit to production. Every use posts to Slack and gets a review afterwards (approved, research recommendation).
- **The override is a thin separate workflow, `deploy-override.yaml`, calling a reusable deploy workflow that `deploy.yaml` also uses** (approved, agent proposal). The two share one hard-coded concurrency group name for production, since a key built from `${{ github.workflow }}` differs between workflows.
- **The override accepts any commit and moves the `production` branch to the commit it deploys** (approved, agent proposal).
- **Hotfixes go to `main` first.** When `main` holds unreleased work, the fix is cherry-picked onto the last production commit, and the override deploys that commit (approved, Codex second opinion).
- **After an override, production pushes resume through a reconcile step that a person runs, not a manual force-push** (approved, Codex second opinion). The person names a destination commit, and the step:
  - runs under the shared production lock;
  - force-updates `production` to the destination with a lease, failing if `production` has moved from the expected commit;
  - accepts only a destination that is fully green on staging, with its artifacts available and an empty `dirty.txt`;
  - records the expected and destination commits;
  - requires the person to confirm that `main` contains the override's fix. Nothing checks that automatically; it rests on the confirmation.
- **Anyone with write access to the repo can run the override, with no required approver** (approved, agent recommendation).
- **The override and the reconcile step are started from `main`** (approved, agent proposal). The `production-hosts` AWS role, and the `production-hosts` GitHub environment's branch rule, accept `main` as well as `production`, but the role trusts `main` only for jobs of the shared reusable deploy workflow. For these workflows this supersedes the requirement in `docs/provenance/01a1ae09-099d-7000-b383-f96896027c92-ci-oidc-parameter-store` that `production-hosts` is pinned to `refs/heads/production`. Branch protection on `main` and `production` is separate work.

## Deploy concurrency

- **The deploy lock** (approved, research recommendation):
  - Checks run without any lock.
  - One per-environment lock covers the deploy and smoke-check steps together.
  - The lock uses `queue: max` and is never cancelled in progress (`cancel-in-progress` is not used).
- **A deploy judges whether it is stale when it acquires the lock** (approved, agent proposal).
- **A staging deploy skips itself only when a strictly newer commit has already deployed to staging** (approved, agent proposal):
  - A newer commit that is merely queued doesn't make it skip, so in-order runs all deploy.
  - When the same commit is already deployed, which only a re-run reaches, the deploy redeploys that run's artifacts and re-runs the smoke checks under the lock, and the commit stays promotable.
  - Once a newer commit has deployed, re-running an older commit's staging run still leaves that commit unpromotable.
- **A production deploy skips itself if its commit is no longer the newest for production** (approved, research recommendation).

## Web bundles and runtime config

- **One build serves both environments.** The frontend and admin bundles are environment-neutral, with config read at runtime, so the exact build staging ran ships to production (approved, research recommendation).
- **The frontend gets its config from its server.** The SSR server builds the config at request time and passes it to the client through the root loader. URLs stay same-origin (approved, research recommendation).
- **`/` and `/guide` are no longer prerendered.** They render on request like every other page (approved, research recommendation).
- **Admin reads a `config.json`** (approved, research recommendation):
  - The file is generated per environment at deploy time, outside the hashed bundle.
  - Admin fetches it before the app mounts and validates it with zod, sharing the schema family in `common/src/web-env.ts`.
  - The fetch has a bounded timeout. Any failure shows a visible error screen, with no fallback environment.
  - nginx serves it at an exact location that returns a real 404 when the file is missing, with `Cache-Control: no-cache`.
  - In development, Vite middleware serves it.
- **The `app_version` PostHog property is removed** (approved, research recommendation):
  - `git_sha` stays as the version and the PostHog release identity.
  - An `environment` property comes from the runtime config.
  - The old persisted `app_version` super-property is unregistered.

## Backend e2e tests

- **The suite runs as 4 shards using Bun's default `--shard=i/4`** split by sorted file name. Each shard is its own job with its own Postgres (approved, agent proposal).
- **No timings file, and no automated PRs refreshing one.** Bun's `--timings` option is not used (user).
- **The duration variance is treated as mitigated, with its cause unconfirmed** (approved, research recommendation):
  - Each shard job logs its CPU model, runner image and Bun version.
  - Each shard job uploads its per-file timings.
  - A controlled experiment happens only if variance still matters on the sharded critical path.

## Mobile bundle check

A job in PR CI (`ci.yaml`), and a job that `deploy.yaml`'s `checks` requires in the staging gate, run an offline production-variant `expo export` for iOS and Android with `APP_VARIANT=production` and no secrets (approved, agent recommendation).

## Visual regression removal

- **Everything visual regression is deleted** (user), including:
  - the `visual-regression` job in `deploy.yaml` and its entry in `checks`;
  - `.github/workflows/mobile-visual-regression-ios.yaml`;
  - `.github/workflows/approve-visual-baseline.yaml`;
  - the `visual-regression` AWS role and the parameters it reads;
  - `VISUAL_REGRESSION_BUCKET` and `SLACK_VISUAL_REGRESSION_CHANNEL_ID` in `.github/ci.env`;
  - the docs in `docs/ci-secrets.md`.
- **The S3 bucket `alliance-ci-storage-32a7c624` is deleted entirely** (user):
  - its policies and the dev IAM user's access to it go with it;
  - all its contents go, including the unrelated `review-workflow/` prefix;
  - nothing is saved first.
- **The user applies the infrastructure changes** (approved, research recommendation):
  - The implementing agent writes the Terraform change and a saved plan (`terraform plan -out`), and lists every destroy in it.
  - The user reviews `terraform show` of that plan and applies that exact file with their own credentials.
  - After the workflow changes merge, the user deletes the script-created SSM parameters.

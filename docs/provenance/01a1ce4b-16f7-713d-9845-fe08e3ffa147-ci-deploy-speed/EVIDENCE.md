# Evidence

Research was done by Claude and Codex subagents on 2026-11-11 and 2026-11-12. Each entry gives the source's status per the root `AGENTS.md` **Established practice**, and which agent read it. "Snippet" means only search-result text was seen. The interviewing agent did not open the external pages itself.

## Industry benchmarks for CI/CD speed

Question: what is the industry standard for how long CI and deploys take?

- **No formal standard sets a CI or deploy duration.** NIST SP 800-204D and SP 800-218 (SSDF) cover pipeline security, not speed. Formal standards; Codex read them. https://csrc.nist.gov/pubs/sp/800/204/d/final, https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf
- **DORA recommends CI feedback in "a few minutes", about 10 minutes at most.** This rests on the 2018 survey of about 1,900 people and is not an experiment showing 10 minutes is optimal. Research-backed; read by both agents. https://dora.dev/capabilities/continuous-integration/
- **Fowler and Extreme Programming practice use the "ten-minute build" as a guideline.** Common practice; Claude read it. https://martinfowler.com/articles/continuousIntegration.html
- **CircleCI's Q3 2026 telemetry puts the median main-branch workflow at 2m 2s,** across 22.1M workflows. Research-backed vendor telemetry; Codex read it. https://circleci.com/landing-pages/assets/2026-q3-state-of-software-delivery-report.pdf
- **At Google, the average wait to submit a change is about 11 minutes.** Common practice (company); Claude read it. https://abseil.io/resources/swe-book/html/ch23.html
- **DORA's commit-to-production benchmarks:** in 2024, elite was under one day. In 2025, 24.4% of 4,867 respondents reported under one day. Self-reported survey; research-backed. Codex read the 2025 report; the 2024 tiers came via a summary. https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf, https://octopus.com/blog/2024-devops-performance-clusters
- **No published benchmark exists for merge-to-staging or merge-to-production pipeline time** (both agents).

## Promotion

Questions: may production skip checks already done on staging, and what if staging evidence is missing?

- **Use the same packages for every environment, with the same deploy process.** Vendor recommendation (research-based); Claude read it. https://dora.dev/capabilities/deployment-automation/
- **Build once and promote the same artifact.** Vendor recommendation and common practice; read by both. https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/, https://continuousdelivery.com/implementing/patterns/
- **AWS calls rebuilding per environment an antipattern.** Vendor recommendation; Codex read it. https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/anti-patterns-for-continuous-delivery.html
- **Google cuts releases from builds that passed all tests,** and cherry-picked fixes go to mainline first. Common practice (company); Claude read it. https://sre.google/sre-book/release-engineering/
- **Test environments are never fully identical to production.** Vendor recommendation; Claude read it. https://sre.google/workbook/canarying-releases/
- **AWS allows overriding deployment blockers to recover, with "a high level of scrutiny".** Vendor recommendation; Claude read it. https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- **AWS prescriptive guidance sends hotfixes through the whole pipeline.** Vendor recommendation; Codex read it. https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-cicd-litmus/environment-integrity.html
- **Azure allows skipping stages for hotfixes, with specific permission.** Vendor; Codex read it. https://learn.microsoft.com/en-us/azure/devops/release-notes/2026/sprint-281-update
- **DORA's 2019 survey (about 1,000 respondents) found no evidence that external approval reduces change failures,** and recommends peer review plus automation. Research-backed (observational); Codex read it. https://dora.dev/capabilities/streamlining-change-approval/
- **Job-level `continue-on-error` stops a failed job from failing the run.** Vendor documentation; read by both. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idcontinue-on-error
- **Partial re-runs keep the results of jobs that weren't re-run,** and the jobs API supports `filter=latest`. Vendor documentation; read by both. https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs, https://docs.github.com/en/rest/actions/workflow-jobs
- **Downloading another run's artifacts takes `run-id` and a token with `actions: read`.** Vendor documentation; Claude read it. https://github.com/actions/download-artifact
- **Microsoft fixes a hotfix in `main` first and cherry-picks it onto the release branch,** keeping unrelated changes out. Common practice (company); Codex read it. https://learn.microsoft.com/en-us/devops/develop/how-microsoft-develops-devops#release-hotfixes
- **`--force-with-lease=<ref>:<expect>` refuses the update unless the remote ref still has the expected value.** It guards against overwriting an unexpected value, not against a replacement that lacks a fix. Vendor documentation; Codex read it. https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegtltexpectgt
- **`git cherry` matches commits by patch ID,** so it can miss a fix that was squashed or changed and can count one that was later reverted. Vendor documentation; Codex read it. https://git-scm.com/docs/git-cherry
- **Emergency access should alert on every use and be reviewed afterwards.** Vendor recommendation; Claude read it. https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-emergency-access

## Deploy concurrency

Question: how should deploys be serialized without making checks wait?

- **GitHub's concurrency semantics:**
  - at most one running member per group;
  - by default one pending member, which a newer arrival replaces;
  - `cancel-in-progress` also cancels the running member;
  - `queue: max` keeps up to 100 pending members and can't be combined with `cancel-in-progress`;
  - ordering "is not guaranteed".

  Vendor documentation; read by both. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency

- **Cancellation sends SIGINT, then SIGTERM, then kills the process tree.** It doesn't roll anything back. Vendor documentation; read by both. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation
- **GitLab recommends serializing deploys and rejecting outdated ones.** Vendor recommendation; Codex read it, Claude saw a snippet. https://docs.gitlab.com/ci/environments/deployment_safety/
- **A concurrency group can span workflows:** runs of different workflows naming the same group share it. Vendor documentation; Codex read it. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- **A called workflow sees its caller's event context,** so `github.event_name` inside it is the caller's event. Vendor documentation; Codex read it. https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_call
- **Events triggered by `GITHUB_TOKEN`, such as a push, don't create workflow runs,** except `workflow_dispatch` and `repository_dispatch`, which always do. Vendor documentation; Claude read it. https://docs.github.com/en/actions/concepts/security/github_token
- **Git rejects a push that isn't a fast-forward of the remote branch unless forced.** Vendor documentation; Codex read it. https://git-scm.com/docs/git-push#_note_about_fast_forwards
- **A job that calls a reusable workflow may set `concurrency`:** it is in the list of keywords such a job allows. Vendor documentation; read by both. https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#supported-keywords-for-jobs-that-call-a-reusable-workflow

## Runtime config for web bundles

Question: how do environment-neutral web bundles get their config?

- **Vite substitutes `import.meta.env` values at build time.** Its docs also say not to put secrets in client env. Vendor documentation; read by both. https://vite.dev/guide/env-and-mode
- **Keep env on the server and expose it through the root loader.** Vendor recommendation; read by both. https://v2.remix.run/docs/guides/envvars/, https://reactrouter.com/7.13.2/start/framework/data-loading
- **Prerendering runs route loaders at build time and writes HTML and `.data` files.** Vendor documentation; read by both. https://reactrouter.com/7.13.2/how-to/pre-rendering
- **Differing initial loader data can cause hydration errors.** Vendor documentation; Codex read it. https://reactrouter.com/7.13.2/how-to/client-data
- **Twelve-Factor separates build from config.** Common practice; read by both. https://12factor.net/build-release-run
- **SLSA verifies artifacts by digest.** Formal standard (v1.0, since retired); Claude read it. https://slsa.dev/spec/v1.0/verifying-artifacts
- **A classic blocking script delays HTML parsing.** Formal standard; Codex read it. https://html.spec.whatwg.org/multipage/scripting.html#the-script-element
- **`no-cache` requires revalidation before reuse.** Formal standard; Codex read it. https://httpwg.org/specs/rfc9111.html#cache-response-directive.no-cache
- **Anything sent to the client can be read or modified.** Common practice; Claude read it. https://cheatsheetseries.owasp.org/cheatsheets/Web_Frontend_Security_Cheat_Sheet.html
- **PostHog recommends the build-time git commit hash as the version for continuously deployed apps.** "Releases describe a single deployment". Super-properties persist across sessions. Vendor documentation; read by both. https://posthog.com/docs/error-tracking/upload-source-maps/cli, https://posthog.com/docs/error-tracking/releases, https://posthog.com/docs/libraries/js/usage#super-properties

## E2e sharding and variance

Questions: how should the e2e suite be split, and is the duration variance worth investigating?

- **Bun's sharding and timings** (vendor documentation; read by both; https://bun.com/docs/test/parallel):
  - Bun 1.4.4 supports `--shard=i/N`, `--timings`, `--update-timings` and `--parallel`;
  - without timings, shards are balanced by file count over sorted paths;
  - every shard must read the same timing files.
- **Each GitHub Actions job gets fresh service containers.** Vendor documentation; Codex read it. https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers
- **Standard GitHub-hosted runners are free for public repositories.** Vendor documentation; read by both. https://docs.github.com/en/actions/concepts/billing-and-usage
- **Where test-splitting tools keep timing data:**
  - CircleCI, Knapsack Pro and Buildkite keep timing history from earlier runs; Bun's CI example uses `actions/cache`;
  - pytest-split recommends committing the durations file;
  - Playwright and Jest don't balance by timing.

  Vendor documentation and common practice; read by both. https://circleci.com/docs/guides/optimize/parallelism-faster-jobs/, https://docs.knapsackpro.com/overview/, https://buildkite.com/docs/test-engine/test-splitting, https://github.com/jerry-git/pytest-split, https://playwright.dev/docs/test-sharding

- **Attributing a cause needs blocking and randomization.** Setup differences bias measurements. Research-backed. Codex read the NIST handbook; Claude read page 1 of the paper. https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm, https://users.cs.northwestern.edu/~robby/courses/322-2013-spring/mytkowicz-wrong-data.pdf
- **The main causes of flaky tests are async waits, concurrency and order dependence.** Research-backed; Codex read it. https://mir.cs.illinois.edu/~marinov/publications/LuoETAL14FlakyTestsAnalysis.pdf
- **GitHub runners may land on different CPU models.** Common practice (vendor blog). Claude read it; unverified for this repo. https://codspeed.io/blog/why-glibc-faster-github-actions

## Mobile bundle check and the OTA gate

Questions: should the staging mobile OTA publish gate production, and should CI build the mobile bundle?

- **`eas update` runs `expo export` before uploading.** Vendor documentation; read by both. https://docs.expo.dev/eas-update/getting-started/
- **Expo suggests `expo export` to expose production JavaScript bundling failures without a native build.** Vendor documentation; Codex read it. https://docs.expo.dev/build-reference/troubleshooting/
- **Expo recommends republishing an update to another channel only when the config matches.** Vendor recommendation; read by both. https://docs.expo.dev/eas-update/deployment/
- **Independent deployability correlates with delivery performance.** Research-backed; read by both. https://dora.dev/capabilities/loosely-coupled-architecture/, https://dora.dev/capabilities/loosely-coupled-teams/

## Infrastructure changes

Question: who should run irreversible Terraform and AWS deletions?

- **Have a human review a saved plan (`plan -out`) and apply that exact file.** Auto-approve is only for non-critical infrastructure. Vendor recommendation; read by both. https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform
- **`prevent_destroy` doesn't guard a resource whose config is removed.** Vendor documentation; read by both. https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
- **`force_destroy` deletes all objects, and only once it has been applied to state.** Vendor documentation; read by both. https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/s3_bucket.html.markdown
- **In a job of a called reusable workflow, the OIDC token's `job_workflow_ref` names the called workflow, while `ref`, `sub` and `workflow` describe the caller.** Vendor documentation; read by Claude on 2026-11-12. https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows, https://docs.github.com/en/actions/reference/security/oidc
- **Emptying and deleting a bucket can't be undone, and another account can take the name.** Vendor documentation; read by both. https://docs.aws.amazon.com/AmazonS3/latest/userguide/empty-bucket.html, https://docs.aws.amazon.com/AmazonS3/latest/userguide/delete-bucket.html

## Measurements

All taken on 2026-11-11 and 2026-11-12, from `gh` run data for `.github/workflows/deploy.yaml` and `ci.yaml` in this repository unless the entry names another method.

- **Pipeline durations** (Codex; 100 CI runs, 80 staging runs Nov 4–11, 30 production runs Oct 21–Nov 11):

  | Run                            | Median   | p90      |
  | ------------------------------ | -------- | -------- |
  | Successful PR CI               | 8.4 min  | 12.8 min |
  | Successful staging workflow    | 13.9 min | 25.8 min |
  | Successful production workflow | 15.5 min | 26.2 min |

  `test-backend-e2e` was the last job to finish in 80 of 82 green PR CI runs. Its median test step was about 7.4 min, with about 0.7 min of setup.

- **Queueing behind the lock:** in runs 42892225193 and 42873097798, e2e started 10 and 12 min after the run was created, behind the workflow-wide concurrency group.
- **E2e test-step time by Bun version.** Each run's version was taken from whether its commit descends from a19bf3e377.

  | Measured by        | Bun 1.3.6                | Bun 1.4.4                |
  | ------------------ | ------------------------ | ------------------------ |
  | Codex (103 jobs)   | median 688 s (418–991 s) | median 436 s (296–546 s) |
  | Claude (195 steps) | median 694.5 s           | median 436 s             |

  Commit a19bf3e377 also changed test-server startup (`server/test/e2e-test-utils.ts:244`), so the cause is confounded. On 1.4.4, the same commit took 307 s in run 42358661119 and 457 s in 42664579000.

- **Shard balance with and without timings.** Per-file wall time was estimated from the log timestamps of job 130834550056 (run 43113257128), and 4 shards were simulated, excluding shard setup:

  | Split               | Per-shard time          | Slowest shard |
  | ------------------- | ----------------------- | ------------- |
  | Bun's by-name split | 111 / 115 / 109 / 141 s | 141 s         |
  | Timing-balanced     | 119 / 119 / 119 / 120 s | 120 s         |

  This is a single sample.

- **Bun's JUnit reporter records each test file's duration:** `bun test --reporter=junit --reporter-outfile=out.xml` on two files with Bun 1.4.4 wrote one `<testsuite>` per file with a `time` attribute.
- **E2e files added:** 9–40 a week over the 8 weeks to 2026-11-11 (`git log --diff-filter=A -- 'server/test/*.e2e-spec.ts'`). Some may be moves.
- **Staging OTA publish:** zero failures in the latest 200 `main` deploy runs (Oct 26–Nov 12) and 4 earlier attempts. All skipped OTA jobs came from runs where an earlier job failed. The last 10 production runs succeeded. In run 43135427346, OTA finished 82 s after the last smoke check.
- **Offline mobile export:** `APP_VARIANT=production expo export --platform ios --platform android` with no Expo token exited 0 in 74–77 s on a developer Mac, possibly with a warm Metro cache. The export step took about 102 s inside production run 42934762392.
- **Staging runs a newer `main` push overtook** (`gh` run and jobs data for `deploy.yaml` `main` push runs, current pipeline, whose lock also holds the checks):

  | Measured by | Window                                                               | Runs | Newer push before the run finished | Before `deploy-nest-backend` started |
  | ----------- | -------------------------------------------------------------------- | ---- | ---------------------------------- | ------------------------------------ |
  | Codex       | 2026-10-30 to 2026-11-12, successful first attempts with a successor | 71   | 14                                 | 11                                   |
  | Claude      | latest 71 push runs to 2026-11-12                                    | 71   | 24                                 | 12                                   |

  Claude's sample also had 10 runs cancelled while pending. The two samples and filters differ, so the counts don't match.

- **`dirty.txt` use** (`git log` of `dirty.txt` on `main`, first parent): 15 changes into non-empty content across 37 changes, counting delete-and-recreate cycles. Entries are added at a commit needing manual work and cleared later, for example `e9ab93aaa8` then `4f8b3f56ec`. `origin/production` holds an empty `dirty.txt`.
- **Production deploys of commits not on `main`** (Codex, re-checked by Claude on 2026-11-11 with the same method: `deploy.yaml` push runs on `production` created 2026-08-13 to 2026-11-11, each `head_sha` tested with `git merge-base --is-ancestor` against `origin/main` at `8196603b37`): 142 runs, 116 successful, 5 of them deploying commits not on `main` (runs 34925701831, 34925845209, 35025663317, 40422251526, 41692403212). This counts runs, not incidents. Run 41692403212 deployed PR #884, which cherry-picked selected `main` changes onto `production`; `git cherry` against `origin/main` reports it unmatched. Each divergence ended with `production` force-updated back onto `main` (forced updates of `origin/production` seen on 2026-10-26 and 2026-11-03), after which successful `main` deploys resumed in runs 40424922943 and 41763723470.
- **Contents of `alliance-ci-storage-32a7c624`** (`aws s3 ls --recursive --summarize`): 14,191 objects, 3.64 GB.

  | Prefix                          | Size                | Dates                    |
  | ------------------------------- | ------------------- | ------------------------ |
  | `visual-regression/production/` | 3.4 GB              | 2026-02-10 to 2026-11-10 |
  | Other `visual-regression/`      | about 50 MB         | February–March 2026      |
  | `review-workflow/`              | 153 MB, 4,854 files | 2026-09-21               |

  Nothing in the repository or its git history references `review-workflow/`.

- **GitHub settings** (`gh api`):
  - the repository retains artifacts and logs for 90 days, the maximum allowed (`actions/permissions/artifact-and-log-retention`);
  - the org is on the Free plan and the repository is public;
  - every environment has only branch-policy rules, with admin bypass on;
  - the `production` branch is unprotected;
  - the `linear` ruleset, active with no bypass actors, requires linear history on `main` (`rulesets`), and the repository allows only squash merges (`allow_merge_commit` and `allow_rebase_merge` are false), so no merge commit can land on `main`.

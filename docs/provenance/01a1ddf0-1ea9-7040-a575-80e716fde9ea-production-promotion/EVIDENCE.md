# Evidence

## Build once and promote

Question: is building once and promoting the same artifacts through every environment a standard, and what do sources say about a commit that reaches production without passing earlier stages? Researched on 2026-11-16 by a Claude research subagent of the review hub; it found no formal standard (ISO, IEEE or similar).

- **Build binaries once, in the pipeline's first stage, and promote that package through every later stage.** Book (Humble & Farley, *Continuous Delivery*, 2010), widely cited; seen through secondary sources only. https://martinfowler.com/bliki/DeploymentPipeline.html, https://sdtimes.com/agile/keeping-software-delivery-on-track/
- **Artifacts "should only be built and packaged once and then deployed to various environments".** Vendor recommendation (AWS deployment pipeline reference architecture). https://pipelines.devops.aws.dev/application-pipeline/
- **"Use the same packages for every environment" and "the same deployment process for every environment, including production".** Research-backed (DORA), about continuous delivery in general; DORA has no study of build-once itself. https://dora.dev/capabilities/deployment-automation/, https://dora.dev/capabilities/continuous-delivery/
- **Pipeline tools have production pick up an artifact only once the upstream stage finishes,** and none starts a parallel rebuild: Spinnaker's "Find Artifact from Execution", Kargo's freight verified upstream, Google Cloud Deploy's promotion. Vendor designs. https://spinnaker.io/reference/artifacts/in-pipelines/, https://docs.kargo.io/user-guide/how-to-guides/working-with-stages, https://docs.cloud.google.com/deploy/docs/promote-release
- **Hotfixes go upstream first and are cherry-picked to the release branch, not committed there directly.** Vendor (GitLab Flow) and common practice (trunk-based development); Google SRE warns that a cherry-picked release branch can hold code found nowhere on mainline, so it needs its own testing. https://about.gitlab.com/blog/what-is-gitlab-flow/, https://trunkbaseddevelopment.com/branch-for-release, https://sre.google/sre-book/release-engineering/
- **No source says what to do with a commit that arrives with no green upstream run;** none describes a lane that skips the checks. Running the full checks and builds for it inside the production pipeline is consistent with all of them, as long as everything that ships was tested; that is the research agent's judgement.
- **Rollback is commonly a redeploy of a known-good artifact, followed by a revert in source;** no standard ranks that above reverting forward. Vendor (Google CRE, GitLab). https://cloud.google.com/blog/products/gcp/reliable-releases-and-rollbacks-cre-life-lessons/, https://docs.gitlab.com/ci/environments/deployments/

## Waiting for staging versus building

Question: when a production push lands while its commit's staging run is still going, should production wait for it or build at once? Researched on 2026-11-16 by a Claude research subagent and a Codex second opinion of the review hub.

- **No guidance covers this race.** The nearest are build-once (above) and pipeline tools that wait by design; a separate production build breaks build-once. Research agent, from the sources above.
- **Octopus recommends at least one required phase before production:** "Any deployment to production must deploy to at least one other environment to verify the fix." Vendor recommendation. https://octopus.com/docs/best-practices/deployments/lifecycles-and-environments
- **DORA's advice for a slow pipeline is to make it faster, not drop stages;** no study measures skipping a staging deploy to save minutes. Research-backed (DORA). https://dora.dev/capabilities/test-automation/
- **`deploy.yaml`'s checks and promotion run outside the production lock,** and staging and production have separate `queue: max` groups, so waiting wouldn't hold production's lock. Codex read `deploy.yaml` and GitHub's concurrency documentation. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- **Standard GitHub-hosted runners are free for public repositories,** so a second build costs runner time but no money. Vendor documentation; Codex read it. https://docs.github.com/en/billing/concepts/product-billing/github-actions
- **No deploy resource collides when staging and production deploy the same commit at once:** separate database instances, hosts, PostHog projects and OTA branches, and per-environment prefixes in the shared deploy bucket. Codex read `deploy-environment.yaml`, the host scripts, `terraform/` and the deployed config; it didn't check live endpoints.

## Production pushes during staging

Measured by the review hub on 2026-11-16 from recent Deploy runs through the GitHub Actions API.

- A staging run takes about 9 minutes; a production run that checks, builds and deploys takes about 9 minutes; the deploy part alone about 3.
- 13 of the last 29 production pushes landed while their commit's staging run was still going, 9 of them with 6 or more minutes of it left.

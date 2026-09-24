# Decisions

- Use GitHub-hosted disposable runners: macOS for iOS, Ubuntu with KVM for Android. Both provide browser tooling. The dispatcher selects the available native platform; the agent chooses journeys and interactions.
- Require a manual dispatch identifying a PR and its exact head SHA. Resolve the base SHA once and validate repository write access for the triggering and rerunning actors. Workflow code comes from the dispatched trusted ref, independently of the PR under test.
- Install host tools before running PR code. Run dependency installation and app builds inside the Codex Action after its API proxy and sudo removal are established. Give the capture job read-only GitHub permissions and no application, deployment, AWS, or signing secrets. The upstream proxy protects the long-lived model key; a job timeout bounds access duration, but is not a dollar spending limit.
- Publish from a fresh Ubuntu job, validate the report and regular PNG files, and pass attachments to GitHub CLI without executing artifact contents. Recheck the PR head before posting.
- Reuse the existing Expo application, synthetic dropdown fixture, visual-test mode, Playwright, Maestro, and simctl. Leave the deployment baseline workflow independent: this feature compares pinned PR revisions and allows exploratory interactions.
- Do not reuse the SQL snapshot for remote evidence: use synthetic fixtures or agent-created synthetic records so public artifacts contain no real personal information.
- Validate an unmerged workflow using a temporary push trigger only on the sample branch. The implementation workflow remains manual-only. This avoids changing the default branch merely to register workflow_dispatch.

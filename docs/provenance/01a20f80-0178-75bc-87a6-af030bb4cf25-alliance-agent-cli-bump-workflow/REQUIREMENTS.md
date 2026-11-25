---
user: Charles Lien
task: Make the Alliance agent's bundled CLI bumps automatic, recording their captures in CI, in place of Dependabot PRs that fail until someone records captures by hand; open a PR for it, after which the open Dependabot PRs are closed.
---

# Requirements

This supersedes the Dependabot bumps recorded in `docs/provenance/01a2093b-ab62-7000-8042-253819be696d-alliance-agent-bundled-clis/DECISIONS.md` (Version bumps).

- A scheduled GitHub Actions workflow replaces `.github/dependabot.yml`'s `/agents/desktop` entry: it bumps each bundled CLI (`@anthropic-ai/claude-code`, `@openai/codex`), regenerates the Codex protocol types for a Codex bump, records the new version's captures in CI, and opens a PR. (agent-proposed, user-approved)
- Codex signs in for recording with the existing `ci/review/OPENAI_API_KEY`; the capture script accepts an API-key sign-in only for this, and the app still counts only a ChatGPT login as signed in. (agent-proposed, user-approved)
- Claude Code signs in for recording with the existing `ci/review/CLAUDE_CODE_OAUTH_TOKEN`. (agent-proposed, user-approved)
- The PR is opened with the workflow's `GITHUB_TOKEN`, as `tzdb-release-watch.yaml` does: the job runs the Alliance agent's typecheck and tests itself and the PR says whether they passed; someone closes and reopens it to run full CI. (agent-proposed, user-approved)
- When the tests fail on a new recording, the workflow records once more; if they still fail it opens the PR anyway with the failure in its description, for a person or agent to fix. The workflow never edits tests. A recording that fails outright, writing no captures, fails the workflow instead of opening a PR. (agent-proposed, user-approved)
- Claude Code is bumped to its npm `stable` tag; Codex to its latest release once that release is 7 days old, matching the cooldown Dependabot used. (agent-proposed, user-approved)
- Captures are recorded on a `macos-latest` runner. (agent-proposed, user-approved)

# Decisions

## Shape

Two workflows: `desktop-cli-bump.yaml` holds the schedule (Tuesdays 15:00 UTC, plus manual dispatch) and runs `desktop-cli-bump-run.yaml` once per CLI through a matrix, so each CLI gets its own PR, as Dependabot gave, and one CLI's failure doesn't hold back the other (agent decision). A reusable workflow rather than one file because the PR-opening job reads the recording job's outputs, which a matrix job overwrites leg by leg (agent decision).

The recording job runs the new CLI with model credentials and holds only `contents: read`; a separate Ubuntu job, holding `contents: write`, applies its patch and opens the PR through `.github/actions/open-superseding-pr`, so a compromised CLI release can't push, and the open job refuses a patch touching anything but `package.json`, `bun.lock`, the Codex protocol types and that CLI's captures (agent decision, from the second-opinion agent and review). The open job takes those files' contents as the recording job wrote them, without re-running the bump itself: a compromised release is already the package the PR bundles and the app runs, and the protocol types it generates are code too, so a tampered `package.json` adds nothing a reviewer of the PR doesn't already have to catch, while re-resolving the lockfile would ship one other than the one the tests ran on (agent decision, from review). It still holds `id-token: write` for the `review` role, so such a release could read everything that role reads; `docs/ci-secrets.md` already accepts that review jobs run code that can assume it, and a role of its own would need Terraform the user didn't ask for (agent decision, from review). The recording job fails when its patch contains the credential it recorded with, since the PR is public (agent decision).

Branches are `desktop-cli/<claude|codex>/<version>`. A run skips a version whose branch has a merged PR or one closed without the `superseded` label, so closing one declines that version, and a newer version's PR supersedes and closes an older open one, as tzdb's watch does (agent decision, following `tzdb-release-watch.yaml`). The two CLIs' PRs edit adjacent lines of `package.json` and `bun.lock`, so once one merges the other conflicts; a run that finds its version's PR open and conflicting records it again from `main` and force-pushes onto it, and otherwise leaves an open PR alone. While an open bump PR of a CLI carries a commit by anyone but the workflow's bot, the workflow neither supersedes nor re-records that CLI's bumps, since either would drop that work (agent decision, from review). Commits are read per PR, since `gh pr list` with commits for every open PR exceeds GitHub's GraphQL node limit (EVIDENCE.md). Both rules live in tested jq filters: `.github/scripts/pushed-by-others.jq`, and `pr-declined.jq`, renamed from `formatjs-declined.jq`, whose rule this workflow shares (agent decision, from review).

## Versions

`bun scripts/bump-cli.ts` reads the npm registry. "Codex at latest once 7 days old" is implemented as Codex's newest release (no prerelease) published at least 7 days ago and neither deprecated nor unpublished on npm, as a broken release gets, which is what Dependabot's cooldown did apart from the deprecation check; reading it as "the `latest` tag, once that release is 7 days old" would never bump while Codex releases more often than weekly, as it did in November 2026 (agent interpretation). Either CLI bumps only to a version newer than the pinned one, since a tag can move back (agent decision). Versions are compared with the `semver` package (agent decision; root `AGENTS.md` prefers a maintained package to hand-rolled parsing). `npm view --before` was tried for the cooldown and doesn't apply to `npm view` (EVIDENCE.md).

## Sign-in

The app strips `CLAUDE*`, `ANTHROPIC_*`, `CODEX*` and `OPENAI_*` from the environment it runs either CLI with (`src/main/agent/agent-environment.ts`), so exporting the credentials doesn't reach the CLIs. Claude Code's token goes in the development config folder's `settings.json` `env`, which Claude Code applies to itself (EVIDENCE.md); Codex signs that folder's `CODEX_HOME` in with `codex login --with-api-key`. Both steps live in the workflow, which alone needs them (agent decision). `readCodexLogin` in `src/main/agent/codex/auth.ts` now tells an API key apart from other credentials, and the Codex capture records on an API key as well as a ChatGPT login; an API key in that folder only gets there deliberately, since the app's own sign-in is ChatGPT's (agent decision).

The workflow sets `ALLIANCE_AGENT_CHATS=off`, which skips the capture scripts' transcript-upload check and makes the repository's upload hooks do nothing (agent decision).

## Retry

Each attempt records and then runs the typecheck, the Codex protocol check and `bun run test`; a failed recording also counts as an attempt, and leaves an earlier attempt's captures in place. After the second, a run where no recording succeeded fails the job, and one whose tests failed opens the PR with the last 80 lines of the last test run's output (agent decision, implementing the requirement).

## Other changes

`src/main/agent/codex/process.test.ts` quoted the pinned Codex version, so every Codex bump failed it; it now reads `CODEX_VERSION` (agent decision, from review).

The `superseded` label's description no longer names the tzdb watch, since this workflow uses it too (agent decision).

The capture scripts' scripted task now checks the edit turn for Error events before checking the file was edited, quoting their messages, since a CI recording that fails otherwise says only that the file wasn't edited (agent decision, from the first CI run).

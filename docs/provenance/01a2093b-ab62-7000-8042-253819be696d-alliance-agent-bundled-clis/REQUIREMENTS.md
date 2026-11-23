---
user: Charles Lien
task: Implement Linear ALL-2029, bundling the pinned claude and codex CLIs in the Alliance agent, in the desktop branch and open a PR
---

Supersedes in part `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/` (the PR 4 row of its PR plan) and `docs/provenance/01a1c699-aec2-75f8-a5bc-f1cfa81f6b09-alliance-agent-claude-adapter/` (its Supported version decision, which had developers re-record and bump whenever their own CLI auto-updated).

## Bundled CLIs

- The app bundles exact versions of `claude` and `codex` and updates them only through its own releases. (agent-proposed, user-approved; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- The bundled CLIs keep their settings, sign-in and session history in folders private to the app (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`), not the user's `~/.claude` or `~/.codex`. (agent-proposed, user-approved; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- The app sends no telemetry, error reports or usage analytics. (user-originated; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- That covers the bundled `claude` and `codex` CLIs, which run with their telemetry, error reporting and usage analytics off. (agent-proposed, user-approved; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- The binaries are fetched at build time at their exact versions, with hash verification, and shipped inside the app, launched by absolute path with an explicit environment. Codex ships with its accompanying resources and its Apache-2.0 notices. (ALL-2029-proposed, user-approved)
- The bundled CLIs' folder is first on `PATH` in the environment the agents run commands in, so a `claude -p` or `codex exec` an agent starts by bare name, as the repository's subagents and review-loop skills do, runs the pinned version with the app's private config and sign-in. (ALL-2029-proposed, user-approved)
- That holds inside Codex sessions too: Codex runs commands without a login shell (`allow_login_shell=false`). At startup the app reads the user's login-shell environment once, with a 30-second timeout, puts the launchers in front of its PATH and gives the result to both CLIs; if reading it fails, the app shows an error saying so and carries on with its default PATH. A CI test keeps the launchers first in a Codex session's commands across CLI bumps. (agent-proposed, user-approved; the user raised the timeout from 10 to 30 seconds in round 5 of the review loop)
- A test asserts the scrubbed environment the CLIs get. (ALL-2029-proposed, user-approved)

## Packaged build

- This PR adds a minimal unsigned electron-builder configuration that builds the app as a folder (`--dir`), with the CLIs as extra resources, and a CI test that the packaged app finds and runs both bundled CLIs with neither on `PATH`. This proves the app finds and launches them, not signing; CI runs on Linux, so it proves the Linux build. Signing, notarization, installers and publishing stay with ALL-2042, which also checks that the re-signed CLIs run and settles where in the macOS bundle they go. (agent-proposed, user-approved)

## Version bumps

- Dependabot proposes bumps of the two CLIs in `agents/desktop`, grouped so each bump is one PR. The app's supported versions are read from `agents/desktop/package.json`, so the bump PR changes everything but the test captures, which a person re-records on that branch with a signed-in CLI; until then the PR fails CI, and its failure says how to record them. Dependabot's config joins the app's removal list. (agent-proposed, user-approved)

## Platforms

- The CLIs are fetched and packaged for macOS on Apple Silicon (arm64) and Linux x64. (agent-proposed, user-approved)

## Codex's voice components

- The packaged app ships Codex's package files whole, its voice components (`codex-resources/voice`, GStreamer libraries under LGPL-2.1) included with their notices and licences, with no guard or turn check for them. Codex's other files and its Apache-2.0 notices ship too. (user-originated)

## Recipients

- Alliance agent builds go only to employees of the Alliance, the same legal organisation, not to contractors, affiliates or the public. (user-originated)

## Sign-in panel

- When Alliance agent can't run its Claude Code or Codex to check the sign-in, the panel's summary reads "Alliance agent couldn't check whether you're signed in to Claude." ("… to Codex." on Codex's panel), with the Details disclosure naming the cause and the Check again button, and no instruction to fix anything and no contact line. (agent-proposed, user-approved)

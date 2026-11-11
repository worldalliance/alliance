---
user: Charles Lien
task: Start ALL-2030 (Claude adapter and sign-in) together with ALL-2090 (AgentSession has no way to end a CLI session) in a new worktree
---

Three research agents (`claude -p`, one per question) researched the first three questions below on 2026-11-10 from briefs that listed the options unordered and without the agent's pick. Each read vendor docs and other projects' source through `gh api`. None found a formal standard for any of the three.

## Research: which folder a session runs in before the app finds the checkout

| Finding | Status | Source |
| --- | --- | --- |
| Claude Code runs where it starts, keeps sessions at `~/.claude/projects/<cwd-derived>/<id>.jsonl` (under `CLAUDE_CONFIG_DIR` when set), and `--resume` searches the current project first | Vendor documentation | https://code.claude.com/docs/en/sessions, https://code.claude.com/docs/en/cli-reference |
| Claude Code desktop gives each session a project folder chosen in a folder control, with an optional worktree per session | Vendor product | https://code.claude.com/docs/en/desktop |
| Codex treats its start folder as the project; its app opens a folder, with worktrees per chat | Vendor product | https://learn.chatgpt.com/docs/projects |
| ACP's `session/new` requires the client to send an absolute `cwd` | Vendor-led protocol spec | https://agentclientprotocol.com/protocol/session-setup |
| Electron's `dialog.showOpenDialog` takes `openDirectory`; `securityScopedBookmarks` applies to Mac App Store builds only | Vendor documentation | https://www.electronjs.org/docs/latest/api/dialog |
| Security-scoped bookmarks persist access for App Sandbox apps | Vendor documentation | https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox |
| Walking skeleton: a tiny end-to-end implementation linking the main architectural components, which need not be the final architecture | Common practice (named by Cockburn); secondary sources only | https://learnagilepractices.substack.com/p/first-steps-in-code-the-significance, https://xebia.com/blog/the-technical-walking-skeleton/ |
| Crystal adds a project by path then makes a worktree per session; opcode has a "Select Project Directory" picker; AionUi has an optional workspace with recent folders; Conductor takes a local folder or GitHub repo and makes a worktree per workspace | Common practice | stravu/crystal@1e18e0bc `main/src/ipc/project.ts`; winfunc/opcode@c24004d3 `src/components/ClaudeCodeSession.refactored.tsx`; iOfficeAI/AionUi@e108b6b5 `CHANGELOG.md`; https://www.conductor.build/docs/concepts/workspaces-and-branches |

The agent could not read Cockburn's own walking-skeleton page, only secondary sources.

## Research: app-private config folder and sign-in

| Finding | Status | Source |
| --- | --- | --- |
| Each `CLAUDE_CONFIG_DIR` has its own settings, history and claude.ai sign-in, except a Claude Console sign-in without an API key, which is stored outside the folder; on macOS the Keychain entry is keyed to the folder, on Linux credentials are `<dir>/.credentials.json` | Vendor documentation | https://code.claude.com/docs/en/authentication |
| Claude Code picks credentials in this order: a cloud provider when `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` or `CLAUDE_CODE_USE_FOUNDRY` is set, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper`, `CLAUDE_CODE_OAUTH_TOKEN`, Anthropic profile and federation credentials (`ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID` with `ANTHROPIC_ORGANIZATION_ID`), then the subscription sign-in; `ANTHROPIC_BASE_URL` routes requests to another endpoint. A signed-in Claude apps gateway session, made through `/login`, sits outside the list and outranks all of these. Rechecked 2026-11-10 | Vendor documentation | https://code.claude.com/docs/en/authentication, https://code.claude.com/docs/en/env-vars |
| Settings precedence is managed > command line > project local > project > user, so a private folder still loads the repository's `.claude/settings.json` | Vendor documentation | https://code.claude.com/docs/en/settings |
| A product may run the unmodified binary with end users signing in with their own subscription through Anthropic's own flow; it may not collect or pass along their credentials | Vendor terms | https://code.claude.com/docs/en/legal-and-compliance |
| Zed's claude-agent-acp shares `~/.claude` and signs in by running `claude auth login --claudeai` in a terminal; opcode hardcodes `~/.claude`; Crystal, Cline and Conductor's CLI mode reuse the existing sign-in. None of the products this file names sets a private `CLAUDE_CONFIG_DIR` or `CODEX_HOME` | Common practice | agentclientprotocol/claude-agent-acp@6bc2e058 `src/auth-methods.ts`; winfunc/opcode@c24004d3 `src-tauri/src/main.rs`; stravu/crystal@1e18e0bc `main/src/services/cliManagerFactory.ts`; https://www.conductor.build/docs/guides/providers |

## Research: whether the minimal chat UI ships with the adapter

| Finding | Status | Source |
| --- | --- | --- |
| A change should be one self-contained change with its tests, the system working after each; about 100 lines is reasonable and 1000 too large; stack changes or split into full-stack vertical features | Vendor recommendation (Google) | https://google.github.io/eng-practices/review/developer/small-cls.html |
| Review 200–400 lines per sitting, for 60–90 minutes | Research-backed, but reported by a vendor (SmartBear's Cisco study); the agent read summaries, not the study | https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/ |
| Review comments get less useful as the number of files grows | Research-backed (Microsoft, MSR 2015; the thresholds come from slides only); the agent read a summary, not the paper | https://www.microsoft.com/en-us/research/?p=168510 |
| Build the thinnest slice that runs end to end first | Common practice (practitioner books by Cockburn and by Freeman and Pryce) | Freeman and Pryce, GOOS ch. 10, https://www.oreilly.com/library/view/growing-object-oriented-software/9780321574442/ch10.html |
| Zed shipped its first ACP agent (#34030, +4839 lines) and its Claude adapter (#34577, +3435) with UI wiring, behind a feature flag, then stop, interrupt and auth as small PRs | Common practice | https://github.com/zed-industries/zed/pull/34030, https://github.com/zed-industries/zed/pull/34577 |
| Roo Code (#4864) and Cline (#4111) added a Claude Code provider with its settings UI in one PR, into a chat UI that already existed | Common practice | https://github.com/RooCodeInc/Roo-Code/pull/4864, https://github.com/cline/cline/pull/4111 |

## Measurements: Claude Code 2.1.322 stream-json

Run locally on 2026-11-10 with the installed `claude` 2.1.322 on macOS, through `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions` in a scratch folder:

- `--session-id <uuid>` sets the session id that every event's `session_id` carries, and `--resume <uuid>` keeps it.
- A `system`/`init` event follows each user message, not process start, so the CLI announces nothing before the first send.
- Text streams as `stream_event` `content_block_delta` events with `text_delta`, then one `assistant` event holding just that block. A tool call arrives as an `assistant` event with a `tool_use` block, its result as a `user` event with a `tool_result` block, and a `result` event ends the turn.
- `{"type":"control_request","request_id":"<id>","request":{"subtype":"interrupt"}}` on stdin stops a turn: a `control_response` with `subtype: "success"`, the partial text block as a whole `assistant` event, a `user` event `[Request interrupted by user]`, then `result` with `subtype: "error_during_execution"`, `is_error: true` and `terminal_reason: "aborted_streaming"`. The same process then ran a further turn normally.
- Closing stdin between turns exits the process with code 0.
- `claude auth login --claudeai` and `claude auth status --json` exist; `status` reports `loggedIn`, `authMethod` and `configDirectory`.
- `claude -p … --resume <uuid>` for a session the config folder doesn't have prints `No conversation found with session ID: <uuid>` on stderr and a `result` with `subtype: "error_during_execution"`, `is_error: true` and that message in `errors` about 0.4 s after start, before any input, and exits with code 1 about 0.4 s later.
- With an app-private `CLAUDE_CONFIG_DIR`, the CLI started in a worktree prints on stderr that it ignores the 3 `permissions.allow` entries of `.claude/settings.json` because the workspace (keyed by the main checkout's path) is untrusted. The repository's `SessionStart` hook still ran (`hook_response` with `outcome: "success"`), and after the session `bun agents/chats/chats.ts fetch claude/<session-id>.jsonl` found its uploaded transcript.
- `claude auth status --json` against a fresh config folder prints `loggedIn: false` and exits with code 1. `claude auth login --claudeai` with stdin closed opened the browser and completed sign-in.
- `strings "$B" | grep -oE 'process\.env\.[A-Z_][A-Z0-9_]*' | sort -u | wc -l`, with `B` the 2.1.322 binary, prints 432. Outside the `CLAUDE` and `ANTHROPIC_` prefixes, the credential- and endpoint-like ones are cloud-provider credentials (`AWS_*`, including `AWS_BEARER_TOKEN_BEDROCK`, `AZURE_*`, `GOOGLE_APPLICATION_CREDENTIALS`), GitHub tokens (`GH_TOKEN`, `GITHUB_TOKEN` and their enterprise forms), proxies (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`), `OTEL_EXPORTER_OTLP_ENDPOINT`, `MCP_CLIENT_SECRET`, and names for Anthropic's hosted runners (`CCR_*`, `SELF_HOSTED_RUNNER_*`, `SESSION_INGRESS_URL`). Run 2026-11-10 on macOS. A parent Claude Code session's environment, read from an agent session the same day, holds `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_PID`, `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN`, and the binary's strings include "Claude Code isn't saving sessions here, because CLAUDE_CODE_SKIP_PROMPT_HISTORY is set or it was started from inside another Claude Code session". A live run against the real CLI on 2026-11-10 under `claudeEnvironment`, which drops those markers, completed a turn and a resume in a new backend that remembered the earlier reply, so the session was saved.

## Measurements: API errors in the 2.1.322 binary

Read on 2026-11-10 from the pinned 2.1.322 binary's bundled JavaScript, since no capture has a failed API call:

- The SDK's `assistant` message schema has `is_api_error_message`, described as "True when this assistant message wraps an API error (from internal AssistantMessage.isApiErrorMessage)", with `api_error_status` and `api_error` beside it, and the code that builds stream-json `assistant` messages sets `is_api_error_message: true` for such a message.
- The `result` line copies the turn's outcome: with `is_error` set it carries the outcome's `result` text and `api_error_status`, so the failure reaches the adapter on the `result` line too.

Not measured: a live failed call's lines. Recording one, for example with an invalid credential, under the capture script would confirm both.

## Research: hooks during close

Vendor documentation, https://code.claude.com/docs/en/hooks, read on 2026-11-10. Verbatim from the page text: under Stop, "Does not run if the stoppage occurred due to a user interrupt."; under SessionEnd, "SessionEnd hooks have a default timeout of 1.5 seconds." and "The overall budget rises automatically to match the highest per-hook `timeout` in your settings files, up to 60 seconds." Under "Configure an async hook", "In non-interactive mode with the `-p` flag, Claude Code kills any async hook still running at teardown and finalizes it with outcome `cancelled`", rechecked verbatim on 2026-11-10 in the page's raw markdown (`/docs/en/hooks.md`). The repository's Stop upload hook is `async: true` and its SessionEnd upload hook has `timeout: 10` (`.claude/settings.json`).

## Measurements: hooks during close

Run on 2026-11-10 on macOS by a reviewer of this branch, with the installed `claude` 2.1.322, through `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions --settings <file>` in an app-private config folder, with the environment filtered as `claudeEnvironment` filters it and `ALLIANCE_AGENT_CHATS=off`. The settings file set Stop and SessionEnd hooks that append a line to a marker file.

- Idle, stdin ended: exit 0; Stop and SessionEnd both ran.
- Idle, stdin ended, then SIGTERM: exit 143; Stop and SessionEnd both ran.
- Mid-turn after 5 text deltas, stdin ended and SIGTERM: exit 143; SessionEnd ran and Stop didn't, as the hooks page says.
- With the SessionEnd hook sleeping 3 seconds before writing, the idle close exited 3.2 s after stdin ended and the mid-turn close 3.1 s after SIGTERM, each after the hook wrote its line, so the CLI waits for SessionEnd hooks under both shutdowns.

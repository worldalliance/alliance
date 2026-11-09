---
user: Charles Lien
task: Go with the build order and test strategy the research agents recommended for the Alliance agent desktop app's agent sessions
---

## Research: build order and tests for a UI over an agent CLI

Question: what is the established practice for building and testing a UI over a streaming, nondeterministic, vendor-controlled agent CLI? Two agents (Codex and Claude) each researched it from one brief on 2026-11-09. The brief omitted the owner's earlier objection to the fake and the agent's recommendation, but it listed the agent's preferred option first without labelling it and said a reviewed fake already existed, so their agreement on restoring the fake right away may reflect the brief. Neither found a formal standard, or a study comparing development orders. Source code shows how projects test, not what they built first. The Claude agent read most docs by keyword extraction and could not open Cockburn's page.

### Build order

| Finding | Status | Source |
| --- | --- | --- |
| A walking skeleton connects the major components through a tiny working path, evolving them together | Common practice (published practitioner guidance) | [Cockburn](https://web.archive.org/web/20140329201356/http://alistair.cockburn.us/Walking%2Bskeleton) |
| A tracer bullet is one thin line of execution end to end | Common practice (published practitioner guidance) | [Hunt and Thomas](https://www.artima.com/intv/tracer.html), [article](https://media.pragprog.com/articles/other-published-articles/ArtInProgramming.pdf) |
| Consumer-driven contracts need provider cooperation, and don't suit public APIs or providers that won't participate | Vendor documentation | [Pact](https://docs.pact.io/getting_started/what_is_pact_good_for) |
| Consumer-driven contracts need provider cooperation | Common practice (published practitioner guidance) | [Robinson](https://martinfowler.com/articles/consumerDrivenContracts.html) |

### Tests

| Finding | Status | Source |
| --- | --- | --- |
| Prefer real implementations when fast, deterministic and simple in their dependencies; otherwise use doubles. One approach to testing a fake runs the same interface tests against it and the real implementation | Common practice (published practitioner guidance from Google) | [Software Engineering at Google, ch. 13](https://abseil.io/resources/swe-book/html/ch13.html) |
| Larger tests are often flakier | Common practice (published practitioner guidance from Google) | [ch. 14](https://abseil.io/resources/swe-book/html/ch14.html) |
| Run tests against the double, and contract tests periodically outside the regular pipeline | Common practice (published practitioner guidance) | [Fowler](https://martinfowler.com/bliki/ContractTest.html) |
| In Meszaros's terms, fakes have working implementations and stubs give canned answers. A canned event script is therefore a stub even when named a fake, which is the agents' inference rather than Fowler's statement | Common practice (published practitioner guidance) | [Fowler](https://martinfowler.com/articles/mocksArentStubs.html) |
| Across 39 frameworks and 439 applications, over 70% of test effort goes to deterministic components | Research-backed, about agent projects generally | [arXiv 2509.19185](https://arxiv.org/html/2509.19185v3) |
| Codex's generated schemas are specific to its version | Vendor documentation | [Codex app-server](https://developers.openai.com/codex/app-server) |
| Claude's docs name `CLAUDE_CODE_OAUTH_TOKEN` for CI pipelines and also document `ANTHROPIC_API_KEY` for non-interactive use and Workload Identity Federation credentials; Codex's docs recommend an API key for CI/CD and document access tokens for private CI runners in ChatGPT Enterprise workspaces | Vendor documentation | [Claude](https://code.claude.com/docs/en/authentication), [Codex](https://developers.openai.com/codex/auth) |
| `ANTHROPIC_BASE_URL` is documented for gateways, a saved login stays active with only that variable set, and new tools have broken gateways | Vendor documentation | [gateway](https://code.claude.com/docs/en/llm-gateway), [connect](https://code.claude.com/docs/en/llm-gateway-connect) |
| Playwright's Electron support is experimental | Vendor documentation | [Playwright](https://playwright.dev/docs/api/class-electron) |

### Common practice

The Claude agent's counts, of the 14 projects below, read at the given commits.

| Practice | Count | Projects |
| --- | --- | --- |
| In-process fake | 9 | Codex TUI, Zed, Continue, Copilot Chat, VS Code, Claude Agent Python SDK, vibe-kanban, claude-code-webui, claudecodeui |
| Recorded traffic | 3 | Cline, Copilot Chat, Happy |
| Real agent with a stub model | 4 | Codex, Continue, Cline, ruflo; only ruflo uses a vendor's unmodified CLI |
| Schema check | 2 | Codex, Copilot Chat |
| Live tests on PRs | 2 | Claude Agent Python SDK, Continue |
| Live tests manual or in no workflow | 4 | Codex, Zed, Happy, AionUi |

opcode has Rust unit tests in two source files, none of the practices above, and no workflow that runs them. AionUi has a fake agent CLI speaking JSON-RPC over stdio (`tests/fixtures/fake-acp-cli/index.js`), a fake at the process boundary; no row counts that practice, so these counts don't say how many other projects use it, and how AionUi's tests launch it wasn't traced. Commits: [Codex `27fcd7cbed`](https://github.com/openai/codex/tree/27fcd7cbed), [Zed `a1f2e21c2c`](https://github.com/zed-industries/zed/tree/a1f2e21c2c), [Cline `5413dc180c`](https://github.com/cline/cline/tree/5413dc180c), [Continue `5522c6f44c`](https://github.com/continuedev/continue/tree/5522c6f44c), [Copilot Chat `5863f5a708`](https://github.com/microsoft/vscode-copilot-chat/tree/5863f5a708), [VS Code `6cde0f16b1`](https://github.com/microsoft/vscode/tree/6cde0f16b1), [Claude Agent Python SDK `2209f2c134`](https://github.com/anthropics/claude-agent-sdk-python/tree/2209f2c134), [ruflo `29be054e85`](https://github.com/ruvnet/ruflo/tree/29be054e85), [AionUi `e108b6b56b`](https://github.com/iOfficeAI/AionUi/tree/e108b6b56b), [Happy `04fd379a9e`](https://github.com/slopus/happy/tree/04fd379a9e), [vibe-kanban `ad41bda058`](https://github.com/BloopAI/vibe-kanban/tree/ad41bda058), [claudecodeui `4e20c29c31`](https://github.com/siteboon/claudecodeui/tree/4e20c29c31), [claude-code-webui `9109263873`](https://github.com/sugyan/claude-code-webui/tree/9109263873), [opcode `c24004d3bb`](https://github.com/winfunc/opcode/tree/c24004d3bb).

Sources disagree on live tests: the Claude Agent Python SDK runs them on same-repo PRs, while [Codex](https://github.com/openai/codex/blob/27fcd7cbed/codex-rs/core/tests/suite/live_cli.rs) ignores them by default "so CI stays deterministic and free".

## Measurements

Spot checks on 2026-11-09 of claims the choice leans on, through `gh api` for other projects' code and locally for the rest:

- These files exist at the cited commits: Codex `codex-rs/app-server/tests/common/mock_model_server.rs` and `codex-rs/app-server-protocol/src/schema_fixtures_tests.rs`, Zed `crates/acp_thread/src/connection.rs`, ruflo `v3/@claude-flow/cli/__tests__/real-binary/run.ts`, Cline `apps/vscode/src/test/e2e/fixtures/server/index.ts`, AionUi `tests/fixtures/fake-acp-cli/index.js`.
- Codex's `live_cli.rs` carries the quoted comment and `#[ignore]`. Zed's `connection.rs` defines `StubAgentConnection`. ruflo's `run.ts` sets `ANTHROPIC_BASE_URL` to a mock with its own `HOME`.
- `claude --help` on Claude Code 2.1.321 lists `--include-partial-messages`, and neither `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/DECISIONS.md` nor `agents/desktop` at commit `13b326d8b1` (the head of closed PR #923) uses it.

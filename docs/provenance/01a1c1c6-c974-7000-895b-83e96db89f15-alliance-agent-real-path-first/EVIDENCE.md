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

## Research: how an isolated app consumes one shared helper

Question: how should a separately installed desktop app inside a monorepo use one small helper from the repository's shared package: a file symlink, a relative import, a workspace or local package dependency, a copy kept in step by an equality test or a sync script, a copy allowed to diverge, or a published package? One Codex agent researched it on 2026-11-09, from a brief that did not name a recommended option. It found no industry standard prescribing this. It read four projects, as historical snapshots through `gh api` rather than a prevalence survey, and they are too unlike the question to show a majority for any mechanism. It verified no example of keeping copies in step with an equality test.

### Guidance

| Finding | Status | Source |
| --- | --- | --- |
| Project linking and internal packages favor named packages; Turborepo also supports unpublished internal packages | Vendor recommendation | [Nx](https://nx.dev/docs/kb/typescript-project-linking), [Turborepo](https://turborepo.dev/docs/core-concepts/internal-packages) |
| Dependencies must be declared | Vendor recommendation | [Bazel dependencies](https://bazel.build/concepts/dependencies), [visibility](https://bazel.build/concepts/visibility) |
| Separately installed tooling is supported, though autoinstallers don't build source | Vendor documentation | [Rush](https://rushjs.io/pages/maintainer/autoinstallers/) |
| Package managers differ on local dependencies: Bun's `file:` copies and installs dependencies and its `link:` doesn't install them, pnpm's `file:` hard-links, Yarn's `link:` can't target packages and its `portal:` can | Vendor documentation | [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/), [pnpm workspaces](https://pnpm.io/workspaces/), [Bun workspaces](https://bun.com/docs/pm/workspaces), [Yarn workspaces](https://yarnpkg.com/features/workspaces), [Bun `file:`](https://bun.com/docs/pm/cli/link#linking-a-directory-by-path), [pnpm `file:`](https://pnpm.io/cli/link), [Yarn `link:`](https://yarnpkg.com/protocol/link), [Yarn `portal:`](https://yarnpkg.com/protocol/portal) |
| `rootDir` governs emission, not inclusion; project references require composite projects and declarations | Vendor documentation | [`rootDir`](https://www.typescriptlang.org/tsconfig/rootDir.html), [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) |
| Preserving symlinks changes module resolution and identity | Vendor documentation | [TypeScript](https://www.typescriptlang.org/tsconfig/preserveSymlinks.html), [Vite](https://vite.dev/config/shared-options.html#resolve-preservesymlinks), [Rollup](https://rollupjs.org/configuration-options/#preservesymlinks) |
| Electron packaging describes which files ship, and electron-vite externalizes main and preload production dependencies by default | Vendor documentation | [Electron ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives), [electron-builder v26](https://www.electron.build/v26/docs/contents/), [electron-vite](https://electron-vite.org/guide/dependency-handling) |
| Git symlinks on Windows may need configuration or privileges, and `core.symlinks=false` produces text files | Vendor documentation | [Git for Windows](https://gitforwindows.org/symbolic-links.html), [git-config](https://git-scm.com/docs/git-config#Documentation/git-config.txt-coresymlinks) |
| One repository supports discoverability and coordinated updates, with selection and tooling bias acknowledged. Read: abstract, introduction and validity section. It does not compare these options | Research-backed | [Google case study](https://storage.googleapis.com/gweb-research2023-media/pubtools/4479.pdf) |
| Monorepos share source and dependencies | Common practice (published experience reports from Google and Meta) | [Google 2016](https://research.google/pubs/why-google-stores-billions-of-lines-of-code-in-a-single-repository/), [Meta](https://engineering.fb.com/2025/10/16/developer-tools/branching-in-a-sapling-monorepo/) |
| DRY favors one authoritative representation of knowledge, while the other three tolerate copying under different conditions. These are heuristics rather than measured thresholds, and the synthesis is the agent's | Common practice (published practitioner guidance) | [DRY chapter](https://media.pragprog.com/titles/tpp20/dry.pdf), [Pike](https://go-proverbs.github.io/), [Fowler, *Refactoring* (1999), ch. 2, "The Rule of Three"](https://martinfowler.com/books/refactoring.html), [Metz](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) |

### Common practice

Four projects, read at the given versions.

| Project | Mechanism | Source |
| --- | --- | --- |
| VS Code 1.95.3 | Separate, centrally orchestrated installs, with a relative import of `../../automation` | [test/smoke/package.json](https://github.com/microsoft/vscode/blob/1.95.3/test/smoke/package.json), [src/main.ts](https://github.com/microsoft/vscode/blob/1.95.3/test/smoke/src/main.ts), [build/npm/postinstall.js](https://github.com/microsoft/vscode/blob/1.95.3/build/npm/postinstall.js) |
| React v19.0.0 | `react-devtools` declares and uses `react-devtools-core` as a workspace package | [package.json](https://github.com/facebook/react/blob/v19.0.0/packages/react-devtools/package.json), [preload.js](https://github.com/facebook/react/blob/v19.0.0/packages/react-devtools/preload.js) |
| Vite v6.0.0 | Explicitly copies Rollup helpers | [build.ts](https://github.com/vitejs/vite/blob/v6.0.0/packages/vite/src/node/build.ts#L1251) |
| Puppeteer v23.9.0 | Re-exports `mitt` from `third_party` and bundles it during the build | [mitt.ts](https://github.com/puppeteer/puppeteer/blob/puppeteer-v23.9.0/packages/puppeteer-core/third_party/mitt/mitt.ts), [Herebyfile.mjs](https://github.com/puppeteer/puppeteer/blob/puppeteer-v23.9.0/packages/puppeteer-core/Herebyfile.mjs) |

Only VS Code has the question's shape, a separately installed package importing code from elsewhere in its repository, and that package is a test harness rather than a shipped app. React's `react-devtools` is a member of the root workspace, and Vite and Puppeteer handle third-party code. VS Code runs against the named-package preference, and Vite shows deliberate copying.

### Costs of each option

Agent judgement, the researching agent's, inferred from the sources above.

| Option | Tooling and CI | Packaging and cross-platform behavior | Removability and discoverability |
| --- | --- | --- | --- |
| File symlink | Resolution settings; track target changes | Bundle target; generally supported on Linux and macOS, with the Windows and `core.symlinks` limits above | Easy deletion; manifest hides the dependency |
| Relative import | Folder-sensitive; CI must track the shared source | Bundle the import; repository checkout needed during the build; no Git symlink prerequisite | Easy deletion; explicit source path, absent from the manifest |
| Workspace, `file:` or `link:` | Manifest graph; install and lockfile changes; the shared package's own dependencies may come along | Check externalization and manager-specific linking | Workspace membership adds cleanup; named imports improve discovery |
| Copy with equality test | CI detects textual drift and humans recopy; equality does not establish correctness | Portable local source; the comparison needs the original | Easy if the check stays inside the app; mark the origin |
| Copy with sync or codegen | Maintain a deterministic script and a CI freshness check | Committed output builds independently; regeneration needs the original | Keep the machinery local; identify the authoritative source |
| Copy allowed to diverge | Own fixes and tests; upstream corrections need deliberate adoption | Self-contained ordinary source | Easy removal; identify the fork and its owner |
| Published internal package | Release, version, registry and upgrade pipeline | Bundle or ship the dependency; no repository-relative paths | The app removes cleanly; the package lifecycle remains; named API |

A narrow unpublished package avoids publication overhead but keeps local-install configuration. The researching agent recommended a relative import bundled into the release: an outward source dependency preserves separate installation and cheap deletion, at the cost of repository-layout coupling, CI triggers for the shared file and verification of the packaged application. That departs from Nx's general preference, to avoid package machinery for one isolated helper. Desktop-only checkout or build requirements would favor synchronized vendoring, and growing shared code or independent consumers would favor a small package.

## Measurements

Spot checks on 2026-11-09 of claims the choice leans on, through `gh api` for other projects' code and locally for the rest:

- These files exist at the cited commits: Codex `codex-rs/app-server/tests/common/mock_model_server.rs` and `codex-rs/app-server-protocol/src/schema_fixtures_tests.rs`, Zed `crates/acp_thread/src/connection.rs`, ruflo `v3/@claude-flow/cli/__tests__/real-binary/run.ts`, Cline `apps/vscode/src/test/e2e/fixtures/server/index.ts`, AionUi `tests/fixtures/fake-acp-cli/index.js`.
- Codex's `live_cli.rs` carries the quoted comment and `#[ignore]`. Zed's `connection.rs` defines `StubAgentConnection`. ruflo's `run.ts` sets `ANTHROPIC_BASE_URL` to a mock with its own `HOME`.
- `claude --help` on Claude Code 2.1.321 lists `--include-partial-messages`, and neither `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/DECISIONS.md` nor `agents/desktop` at commit `13b326d8b1` (the head of closed PR #923) uses it.

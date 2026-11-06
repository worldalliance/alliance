---
user: Charles Lien
task: Do ALL-2028, PR 3 of the Alliance agent desktop app plan: the agent session interface, event types and a scripted fake backend.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

## Root unit-test runs

- `citesting`'s tests ran in neither `scripts/test-all.sh`'s `PACKAGES` nor the `test-unit` matrices of `ci.yaml` and `deploy.yaml`, so all three list it, and `test-unit.yaml` installs Chromium for its browser tests (agent decision).
- `scripts/covercheck.ts` and `test-all.sh` match every extension `bun test` discovers, `.mjs`, `.cjs`, `.mts` and `.cts` included (agent decision).
- `scripts/test-all.test.ts` fails on any tracked file `bun test` would discover outside `PACKAGES` and `agents/desktop`, whose own `bun run test` runs `bun test` before Playwright in `desktop.yaml`, so a package's tests can't drop out of `bun run test` silently; it checks `PACKAGES` only, and ALL-2064 covers checking the matrices. It shares the `PACKAGES` parse and the discovery rule with `covercheck` through `scripts/lib/test-packages.ts` (agent decision).
- The lists name `agents/hooks` rather than `agents`, so the app's `*.test.ts` unit tests, which need the app's own install, stay out of runs that install only the root lockfile. This replaces the spec's choice to keep listing `agents` until the app's first test `bun test` discovers (agent decision).

## `Result` copy

The app keeps its own copy of `common/src/result.ts` at `agents/desktop/src/main/result.ts`, its doc example importing from the copy. It arrives with this PR's session interface, whose `start` and `resume` can fail to spawn a CLI, as the spec planned for the first fallible operation. The root `AGENTS.md`'s `Result` rule points at the copy so the two change together. That pointer joins the spec's list of edits outside `agents/desktop` under Location, so removing the app reverts it, and `agents/README.md`'s removal note names the provenance directories that build on the spec beside the spec itself (agent decision). A unit test fails when the copy differs from `common/src/result.ts` other than in its doc example's import, and `desktop.yaml`'s path filter includes that file, so a change to either copy alone fails CI (agent decision).

## Bun unit tests

The app's `bun run test` runs `bun test` before Playwright. Only `tsconfig.test.json`, which typechecks the `*.test.ts` files, has Bun's types, so main-process code, which runs on Electron's Node, can't typecheck a Bun global (agent decision).

## Session interface

The interface lives in `agents/desktop/src/main/agent/session.ts` (agent decisions):

- `start` and `resume` return a `Result` holding a session whose `id` is known up front, so the app can save it for resume before the first turn: Claude takes one through `--session-id`, and Codex's `thread/start` returns one.
- `send` returns nothing; replies arrive as events to `subscribe`'s listeners, so the status and notification code of PR 11 can listen beside the chat view. Every turn ends with exactly one turn-ended event, an interrupted or failed one included, with any error event before it; status then reads failed when an error came during the turn. A process exit an adapter didn't ask for is reported as an error followed by turn ended, rather than as a sixth event kind. Every event arrives during a turn, so the UI never sees a turn ended without a turn: a process that exits between turns is reported by the next `send`, as an error then turn ended (agent decision).
- Assistant text carries one complete text block, never a streaming delta, so the UI adds a message per event. Claude's stream-json sends whole messages unless `--include-partial-messages` is on, and Codex's `app-server` completes each agent message item with its full text after its deltas (agent decision).
- `send` during a turn throws: the chat UI disables its composer until the turn ends, and the two CLIs differ on queued input.
- `interrupt` only asks the turn to stop: its turn-ended event may arrive after `interrupt` returns, and `send` throws until it does, so the UI waits for turn ended and works whether a backend ends the turn at once or waits for its CLI to confirm. Between turns it does nothing, since a UI can interrupt just as a turn ends (agent decision).
- A listener that throws is logged, and the other listeners and the turn's turn-ended event still arrive, so one faulty listener can't leave a session mid-turn for good; every backend dispatches this way, not only the fake (agent decision).
- A session's `id` is its CLI's own session id, and resume keeps it, so the id the app saves stays valid. Resuming a session already live in this process returns that session rather than starting a second CLI process on the same history, even mid-turn; the session doesn't report whether a turn is running, so a caller that needs to know tracks it from the events it has subscribed to, and none does yet. Resuming any other session starts the CLI on its saved history in the given worktree (agent decision).
- An image is its media type (PNG, JPEG, GIF or WebP, the formats Claude accepts) and its bytes, which survive Electron's structured-clone IPC. The Claude adapter base64-encodes them; the Codex adapter writes them to a file for its `localImage` input.
- This PR adds no preload script or IPC channel, since nothing in the renderer uses a session yet; PR 7, the first renderer that needs the main process, adds them.

## Fake backend

The fake backend (`fake-backend.ts`) plays a script of turns, each a function from the user's message to its events, with a set delay between events; the fake adds each turn's turn-ended event, and a script's type can't hold one (agent decisions). It dispatches as DOM event dispatch does (https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke): to the listeners subscribed when the event fires, skipping any removed since, and a listener that throws is logged while the others still hear the event, so one faulty listener can't leave a session mid-turn for good. `interrupt` drops the turn's remaining events and ends the turn after the current step delay, never during a dispatch, so the UI can't come to rely on a turn ending as `interrupt` returns. Its `demoScript` covers text, a passing and a failing tool call, a reply to an image message and an error, for the chat UI to develop against. It keeps its sessions in memory, so resume works only within one app run.

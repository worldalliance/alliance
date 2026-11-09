---
user: Charles Lien
task: Do ALL-2028, PR 3 of the Alliance agent desktop app plan: the agent session interface, event types and a scripted fake backend.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

## Root unit-test runs

- `citesting`'s tests ran in neither `scripts/test-all.sh`'s `PACKAGES` nor the `test-unit` matrices of `ci.yaml` and `deploy.yaml`, so all three list it, and `test-unit.yaml` installs Chromium for its browser tests (agent decision).
- `scripts/covercheck.ts` and `test-all.sh` match every extension `bun test` discovers, `.mjs`, `.cjs`, `.mts` and `.cts` included (agent decision).
- `scripts/test-all.test.ts` fails on any tracked file `bun test` would discover outside `PACKAGES` and `agents/desktop`, whose own `bun run test` runs `bun test` before Playwright in `desktop.yaml`, so a package's tests can't drop out of `bun run test` silently; it checks `PACKAGES` only, and ALL-2064 covers checking the matrices. It shares the `PACKAGES` parse and the discovery rule with `covercheck` through `scripts/lib/test-packages.ts` (agent decision).
- The lists name `agents/hooks` rather than `agents`, so the app's `*.test.ts` unit tests stay out of runs that install only the root lockfile, and `desktop.yaml`, which installs the app's, runs them. This replaces the spec's choice to keep listing `agents` until the app's first test `bun test` discovers (agent decision).

## `Result` import

The app imports `common/src/result.ts` by relative path and keeps no copy. That is the one exception to the spec's requirement that it imports nothing from `common/`, and it replaces the spec's decision to keep a copy of the helper; the requirement and the reasons for it are in `docs/provenance/01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first/`. The import arrives with this PR's session interface, whose `start` and `resume` can fail to spawn a CLI, as the spec planned for the first fallible operation. `desktop.yaml`'s path filter includes that file, since the app depends on it.

## Bun unit tests

The app's `bun run test` runs `bun test` before Playwright. Only `tsconfig.test.json`, which typechecks the `*.test.ts` files, has Bun's types, so main-process code, which runs on Electron's Node, can't typecheck a Bun global (agent decision). The `agents/desktop` exemption (`OWN_CI`) in `scripts/test-all.test.ts` joins the spec's list of edits outside `agents/desktop` under Location, so removing the app reverts it (agent decision).

## Session interface

The interface lives in `agents/desktop/src/main/agent/session.ts` (agent decisions):

- `start` and `resume` return a `Result` holding a session whose `id` is known up front, so the app can save it for resume before the first turn: Claude takes one through `--session-id`, and Codex's `thread/start` returns one.
- `send` returns a `Result`, its one failure being a turn already running; replies arrive as events to `subscribe`'s listeners, so the status and notification code of PR 11 can listen beside the chat view. Every turn ends with exactly one turn-ended event, an interrupted or failed one included, with any error event before it; status then reads failed when an error came during the turn. A process exit an adapter didn't ask for is reported as an error followed by turn ended, rather than as an event kind of its own. Every event arrives during a turn, so the UI never sees a turn ended without a turn: a process that exits between turns is reported by the next `send`, as an error then turn ended (agent decision). `send` emits nothing before it returns, so a listener sending from turn ended can't put the next turn's events ahead of the previous turn-ended at another listener (agent decision).
- Assistant text streams: delta events each extend the text block being written, and one assistant-text event then carries the whole block, so the UI can show text as it is written while transcripts and notifications need no reassembly. Both CLIs end a block this way: Claude's stream-json with `--include-partial-messages` on, and Codex's `app-server`, which completes each agent message item with its full text after its deltas. A block can arrive whole with no deltas, and turn ended closes one that an interrupt left unfinished (agent decision).
- `send` during a turn fails rather than queueing: the chat UI disables its composer until the turn ends, and the two CLIs differ on queued input. It fails through its `Result` rather than a throw, per the root `AGENTS.md` `Result` rule, since `resume` can hand back a session already mid-turn (agent decision).
- `interrupt` only asks the turn to stop: it emits nothing before it returns, since a listener can call it during a dispatch and a turn-ended emitted from inside that call would reach later listeners ahead of the event in flight. `send` fails until the turn-ended event, so the UI waits for it and works whether a backend ends the turn at once or waits for its CLI to confirm. Between turns it does nothing, since a UI can interrupt just as a turn ends (agent decision). The interrupt itself emits no error event, so a stop the user asked for doesn't read as a failed turn on one CLI and not the other; a backend drops any error its CLI reports for it (agent decision).
- A listener that throws is logged, and the other listeners and the turn's turn-ended event still arrive, so one faulty listener can't leave a session mid-turn for good; every backend dispatches this way, not only the fake (agent decision).
- A session's `id` is its CLI's own session id, and resume keeps it, so the id the app saves stays valid. Resuming a session already live in this process returns that session rather than starting a second CLI process on the same history, even mid-turn, and `turnRunning` tells the caller so, since it has heard none of that turn's earlier events. Concurrent resumes of one id resolve to the same session, so a backend keeps the in-flight start. Resuming any other session starts the CLI on its saved history in the given worktree (agent decision).
- A session whose CLI has exited is no longer live: its sends keep reporting an error then turn ended, and `resume` starts the CLI again and returns a new session. A caller recovers from any error by resuming, which returns the same session when its CLI is still running, so the error event needn't say whether the CLI is gone (agent decision; the thin path checks it against the real CLIs).
- A tool-started event's `name` and `input` carry each CLI's own vocabulary, for generic display, which narrows the spec's "the UI never sees vendor types" to the event shape. A normalized tool kind waits for the thin path's captures of both CLIs to show what the UI needs (agent decision).
- An image is its media type (PNG, JPEG, GIF or WebP, the formats Claude accepts) and its bytes, which survive Electron's structured-clone IPC. The Claude adapter base64-encodes them; the Codex adapter writes them to a file for its `localImage` input.
- This PR adds no preload script or IPC channel, since nothing in the renderer uses a session yet; PR 7, the first renderer that needs the main process, adds them.

## Listener dispatch

`SessionListeners` (`listeners.ts`) is the dispatcher every backend delegates `subscribe` to, so the Claude and Codex backends can't drift from what `session.ts` promises. It is extracted before its second caller because the real backends are the next work (agent decision). It dispatches as DOM event dispatch does (https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke): to the listeners subscribed when the event fires, skipping any removed since, and a listener that throws is logged while the others still hear the event, so one faulty listener can't leave a session mid-turn for good. Each `subscribe` is its own subscription, so a listener re-subscribed mid-dispatch first hears the next event and an old unsubscribe can't end a later subscription (agent decision).

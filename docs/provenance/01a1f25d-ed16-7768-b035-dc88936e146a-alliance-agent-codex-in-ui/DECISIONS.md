# Decisions

## Scope

ALL-2032's other remaining work, tool activity in plain words, image paste and drop, and the model and effort picker, is left to later PRs under the same issue (agent decision, following the stacked-PR requirement this task restates and the size of earlier ALL-2032 PRs #973, #995 and #1012). ALL-2032 stays open.

## Sign-in

- Each agent's sign-in is checked the first time the app needs that agent: Claude's on launch, since New conversation starts on Claude, and Codex's once Codex is chosen or a Codex conversation is opened. An agent nobody uses never runs its CLI (agent decision, `useAgentAccess` in `agents/desktop/src/renderer/src/agent-access.tsx`).
- A saved conversation opens, which starts its CLI, only once its agent is signed in, so a signed-out agent's session never starts and fails on the first send (agent decision).
- The sign-in panel shows under the view's own heading, so its heading is an `h2`. It takes focus only when focus would otherwise land on the page body, so picking Codex keeps focus on the choice (agent decision, ux-guidelines on focus after a view change).

## The agent choice

- Two native radio buttons, "Claude" and "Codex", under the legend "Agent" on New conversation. GNOME's guidelines say not to use a drop-down for fewer than three items ([GNOME HIG, drop-downs](https://developer.gnome.org/hig/patterns/controls/drop-downs.html), vendor recommendation, checked 2026-11-18), and a native radio shows the selected one by its filled dot, not by colour alone (agent decision).
- Moving an unread first message to a new conversation keeps that conversation's agent as well as its folder (agent decision).
- Once a conversation starts, New conversation goes back to Claude for the next one, as the restated requirement has each new conversation start on Claude, while the folder stays chosen. Picking an agent clears the error from an earlier attempt, which may name the other agent (agent decision, review round 1).
- Each sidebar row names its agent before its folder, such as "Codex · checkout", so a reader knows which sign-in a conversation needs before opening it (agent decision, from the brainstormer's report).
- The wording that named Claude now names the conversation's agent: "Message Codex", "Codex is working…", errors, and the note about earlier messages. A message about the CLI itself names the product, "Claude Code" or "Codex" (agent decision).

## Saved conversations

The file moves to version 2 and adds each conversation's `agent`. Version 1, which predates the field, reads as Claude's conversations, as the restated requirement says, and the next write saves version 2. Bumping the version makes an older build fail loudly on the file rather than drop the field, since zod strips unknown keys, which would turn a Codex conversation into a Claude one. No release of the app exists yet (ALL-2042), so the only older readers are development builds, which keep their data inside each checkout's `.scratch/user-data` (agent decision, after the second opinion questioned exempting them).

## Executables

`findExecutable` finds either CLI the way the Claude-only lookup did: a variable naming it (`ALLIANCE_AGENT_CLAUDE_EXECUTABLE`, `ALLIANCE_AGENT_CODEX_EXECUTABLE`, the latter already used by the Codex capture run, which now finds its `codex` through `findExecutable` too), otherwise the command on `PATH`, until ALL-2029 bundles them. A development run uses the one development `CODEX_HOME` the capture run already signs in to, as it does the development Claude config folder (agent decision).

## Quitting

A Codex launch whose setup fails returns its failure at once and closes its app-server in the background, since that close may wait out the kill timeouts. Quitting waits for those app-servers through `AgentBackend.settled`, as it waits for every other CLI the app started, so app.exit doesn't cut off their exit or the kill that ends a hung one (agent decision, review round 3). `settled` also waits for a launch that fails while it waits, and the quit keeps draining session closes and `settled` until neither grows, so a session that finishes starting while a failed setup's app-server exits is closed and waited for too (agent decision, review round 4).

## Tests

The Playwright config points both variables at the replay stubs, so no test reaches either real CLI. `e2e/codex.e2e.ts` runs the thin path through the built app on Codex's captures: start, streamed reply, tool calls, stop, a turn after it, and resume after a relaunch. It also checks that a signed-out Codex shows its sign-in in a Codex conversation and on New conversation, while Claude stays usable. Two more run Sign in to Codex through a stand-in `codex`: one checks that `codex login` runs in the app's own `CODEX_HOME` and that the message box follows, the other that Cancel sign-in stops it. The checkout it works in holds the captured hooks file, as the Codex backend tests' does. `e2e/codex-ipc.e2e.ts` checks the main process's routing through IPC alone: a Codex conversation is saved as Codex's and resumes on Codex, cancelling one agent's sign-in leaves the other's running, and quitting waits for an app-server a failed Codex setup closes and for a session that finishes starting while it exits. `e2e/sign-in.e2e.ts` checks the renderer's per-agent sign-in with stand-in IPC handlers: each agent is checked when a view first needs it, both agents' sign-ins stay pending across navigation, cancelling one leaves the other's, and a saved conversation opens only once its own agent signs in.

---
user: Charles Lien
task: Create a PR for ALL-2032 (the Alliance agent's chat UI)
---

This task builds on the desktop-app spec (`docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`), the real-path-first build order (`docs/provenance/01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first/`), the session interface (`docs/provenance/01a1ae9f-f048-7000-9755-74cef3cbc0e8-alliance-agent-session-interface/`) and the Claude adapter (`docs/provenance/01a1c699-aec2-75f8-a5bc-f1cfa81f6b09-alliance-agent-claude-adapter/`). Their decisions stand except where an entry here replaces one. Paths below are relative to `agents/desktop/`.

## Scope: the thin path's UI, not the whole chat

The real-path-first REQUIREMENTS.md has ALL-2032 start as the minimal UI the thin path needs (send, streamed text, one tool call, interrupt, resume) and widen only once that path runs on both CLIs. The Codex adapter (ALL-2031) doesn't exist yet, so this PR is that minimal UI over the Claude adapter, and the PR says `Part of ALL-2032` rather than closing it (agent decision). Left for the widening PRs: image paste and drop, the Advanced model and effort picker, the Claude or Codex choice per session, Markdown rendering, and showing a resumed conversation's earlier messages (which needs the transcript reader of ALL-2039).

The Claude adapter task planned its merge after the thin path ran through this UI on a stacked branch; it merged first, so this PR is where that check happens. It ran against the real Claude Code 2.1.322 (see Verification in the PR).

## Folder and conversations

- The main process keeps the conversations it started (session id, folder, first message as title, start time) in `conversations.json`, so a conversation can be resumed after a relaunch, since Claude Code keys sessions to their folder. Writes are serialised and replace the file whole through `write-file-atomic`, which syncs a uniquely named temporary file before renaming it over the list. A file that doesn't parse fails loudly rather than reading as empty (agent decision, per the root `AGENTS.md` fail-loudly rule).

## Finding the CLI until it is bundled

Until ALL-2029 bundles the CLI, an unpackaged app runs the `claude` it finds on `PATH`, or the executable `ALLIANCE_AGENT_CLAUDE_EXECUTABLE` names, which the Playwright tests point at the stub. A packaged app reports that the CLI isn't included. The adapter's version check still refuses any version but the pinned one. The variable is read only when unpackaged, as `ELECTRON_RENDERER_URL` is (agent decision).

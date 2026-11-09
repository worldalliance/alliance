---
user: Charles Lien
task: Go with the build order and test strategy the research agents recommended for the Alliance agent desktop app's agent sessions
---

This task supersedes the order of the PR plan in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`, and the hand-written scripts of the fake backend in `docs/provenance/01a1ae9f-f048-7000-9755-74cef3cbc0e8-alliance-agent-session-interface/` once it replays captures.

## Build order

- The reviewed session interface (`agents/desktop/src/main/agent/session.ts`) and scripted fake backend (`agents/desktop/src/main/agent/fake-backend.ts`), first written in commits `2cd1ee066d` and `34adc1bbd9` on closed PR #923, are restored now, rather than waiting for real captures. (agent-proposed, user-approved)
- Before the chat UI widens, one thin path runs through the real UI on each of the `claude` and `codex` CLIs at their pinned versions, covering send, text streamed as it is written rather than in whole blocks, one tool call, interrupt and resume. (agent-proposed, user-approved)
- Raw CLI output from those runs is captured per CLI version, with secrets and personal information redacted. (agent-proposed, user-approved)
- The fake backend replays those captures. Only states that can't be captured are hand-scripted. (agent-proposed, user-approved)

## Tests

- Every PR that runs the desktop app's CI runs parser tests on the captures, Playwright tests of the built app against the fake backend, and a schema comparison against the pinned Codex version. (agent-proposed, user-approved)
- Every such PR also runs a few scenarios of the real pinned CLI against a stub model endpoint, if a spike shows both CLIs can finish a turn against a stub without a login. (agent-proposed, user-approved)
- Each CLI version bump, and a schedule once CI has a credential, runs live smoke tests against the real service and recaptures output, comparing event shape rather than text. (agent-proposed, user-approved)

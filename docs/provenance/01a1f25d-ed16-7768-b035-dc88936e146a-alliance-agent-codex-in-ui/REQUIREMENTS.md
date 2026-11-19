---
user: Charles Lien
task: Work on ALL-2032 (Alliance agent: chat UI) in the desktop branch, then open a PR
---

This task is the PR stacked on the Codex adapter that `docs/provenance/01a1eb56-c1a4-7029-9df3-911550b88646-alliance-agent-codex-adapter/` describes. It supersedes, in `docs/provenance/01a1c8de-85d2-77b0-81c2-cb8d65480336-alliance-agent-minimal-chat-ui/` and the code it left, the Claude sign-in that gates the whole app.

## Scope

- This PR adds the Claude or Codex choice, fixed per conversation and saved with the conversation's session id (conversations saved before it count as Claude), and runs the thin path (send, text streamed as it is written, one tool call, interrupt, resume) through the app's UI on Codex. (agent-proposed, user-approved; restated from 01a1eb56-c1a4-7029-9df3-911550b88646-alliance-agent-codex-adapter)
- A "Sign in to Codex" action runs the CLI's own `codex login` in the app's private `CODEX_HOME`, and `codex login status` decides whether the user is signed in. (user-originated; restated from 01a1eb56-c1a4-7029-9df3-911550b88646-alliance-agent-codex-adapter)
- Every PR that runs the desktop app's CI runs Playwright tests of the built app against replayed captures. (agent-proposed, user-approved; restated from 01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first)

## Sign-in

- No sign-in gates the whole app. The New conversation screen shows the agent choice and, while the chosen agent is signed out, that agent's sign-in there. Opening a saved conversation whose agent is signed out shows that agent's sign-in in place of the message box, and messages already shown stay readable. (agent-proposed, user-approved)

## The agent choice

- A new conversation starts on Claude unless the user picks Codex for it. (ALL-2032-proposed, user-approved)

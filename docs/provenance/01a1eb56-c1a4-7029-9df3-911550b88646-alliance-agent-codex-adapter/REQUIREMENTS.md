---
user: Charles Lien
task: Do ALL-2031 (Alliance agent: Codex adapter and sign-in) and open its PR from the alliance-agent-ui-worktrees-setup-plan branch
---

This task is PR 6 (ALL-2031) of the plan in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`, in the build order of `docs/provenance/01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first/`, whose requirements apply to it. It supersedes, in the first of those, the Codex sign-in through app-server's ChatGPT login flow that ALL-2031 describes.

## Scope and sequencing

- The PR opens from the `alliance-agent-ui-worktrees-setup-plan` branch. (user-originated)
- This PR holds the Codex adapter, Codex sign-in, hook trust, captures, tests and the CI schema comparison. A PR stacked on it adds the Claude or Codex choice, fixed per conversation and saved with the conversation's session id (conversations saved before it count as Claude), and runs the thin path through the app's UI. (agent-proposed, user-approved)
- This PR merges only after the stacked branch has run the full thin path (send, text streamed as it is written, one tool call, interrupt, resume) on Codex through the app's UI. (agent-proposed, user-approved)

## Adapter

- The adapter runs `codex app-server` over JSON-RPC on stdio with approvals and sandbox off, and maps threads, turns and items onto the session interface in `agents/desktop/src/main/agent/session.ts`; `turn/completed` ends a turn. (agent-proposed in ALL-2031, user-approved)
- Images go to Codex as `localImage` inputs. (agent-proposed in ALL-2031, user-approved)
- The protocol types are generated from the pinned Codex version (`codex app-server generate-ts`). (agent-proposed in ALL-2031, user-approved)
- It starts as the thin path on the installed CLI at its pinned version: send, streamed text, one tool call, interrupt, resume. ALL-2029 later swaps in the bundled binary. (agent-proposed in ALL-2031, user-approved)
- Done when the scripted task the Claude adapter's capture run performs passes on Codex, including an image. (agent-proposed in ALL-2031, user-approved)
- Raw output from those runs is captured per Codex version, redacted, for the fake backend to replay. (agent-proposed in ALL-2031, user-approved)

## Sign-in

- A "Sign in to Codex" action runs the CLI's own `codex login` in the app's private `CODEX_HOME`, as "Sign in to Claude" runs `claude auth login --claudeai`, and `codex login status` decides whether the user is signed in. (user-originated)

## Hook trust

- Codex loads project hooks only once the project and its hooks are trusted, and a fresh private `CODEX_HOME` trusts nothing, so the app writes that trust for the main checkout, whose `.codex/hooks.json` Codex runs in every worktree, into its private `config.toml`. (agent-proposed in ALL-2031, user-approved)
- Before each session the app trusts the main checkout and whatever hooks it currently defines, then lists the hooks again to confirm they show as trusted. (agent-proposed, user-approved)
- A test starts `app-server` in a worktree with a fresh `CODEX_HOME` and sees the transcript upload hook fire. (agent-proposed in ALL-2031, user-approved)

---
user: Charles Lien
task: Spec an Alliance-specific desktop app that wraps the `claude` and `codex` CLIs, so every employee works with coding agents through it, with Alliance features such as worktree tracking, Infisical sign-in, repo setup, agent tracking and transcripts; split the build into many PRs
---

## Product

- The app is named "Alliance agent". Its name and logo contain neither "Claude" nor "Anthropic". (user-originated)
- It is an internal development tool for Alliance employees, not a product: the Alliance builds it for its own employees and does not market or support it for anyone else. (user-originated)
- Every employee works with coding agents through this one app, and most of them are non-technical. The UI must be usable without technical knowledge; a terminal-style interface such as cmux is too technical. (user-originated)
- Employees chat with agents inside this app; it never sends them to a second app to chat. (user-originated)
- It has no terminal or TUI mode. Technical users who want one run `claude` or `codex` themselves. (user-originated)
- It renders its own chat UI over the `claude` and `codex` CLIs, run unmodified as child processes. It does not use the Claude Agent SDK. (user-originated)
- Claude and Codex are both available from the first version. (user-originated)
- Each employee uses their own Claude and ChatGPT subscription. (user-originated)
- It sends no telemetry, error reports or usage analytics. (user-originated)
- That covers the bundled `claude` and `codex` CLIs, which the app runs with their telemetry, error reporting and usage analytics off. (agent-proposed, user-approved)
- Planned features include, but are not limited to, the ones below; more will follow. (user-originated)

## Platforms and framework

- macOS first, then Linux; Windows only if someone asks for it. (agent-proposed, user-approved)
- Built with Electron. (agent-proposed, user-approved)

## Location and removability

- The app's code lives in this repository, under `agents/`. (user-originated)
- It can be removed easily if the Alliance decides it doesn't want it. (user-originated)
- It is its own package with its own `package.json` and lockfile, outside the `apps/frontend` install, and imports nothing from `common/`. (agent-proposed, user-approved)

## Agents

- Agents run with no permission prompts: Claude with the equivalent of `--dangerously-skip-permissions`, Codex with the equivalent of approvals and sandbox off (`--dangerously-bypass-approvals-and-sandbox`). (user-originated)
- The app bundles exact versions of `claude` and `codex` and updates them only through its own releases. (agent-proposed, user-approved)
- The bundled CLIs keep their settings, sign-in and session history in folders private to the app (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`), not the user's `~/.claude` or `~/.codex`. (agent-proposed, user-approved)
- When the app quits, its agents stop; on the next launch, each can be resumed from its saved session. (agent-proposed, user-approved)
- A new session starts on the CLI's own default model and effort. A model and effort picker sits behind an "Advanced" control. (agent-proposed, user-approved)
- Users can paste or drop images into the chat, and both CLIs receive them as images. Other files are passed to the agent as paths in the worktree. (agent-proposed, user-approved)
- The app shows an OS notification when an agent's turn ends or fails, and a badge on the dock icon. (agent-proposed, user-approved)

## Work, worktrees and repository

- Worktrees are created and removed through `scripts/new-worktree.sh` and `scripts/rm-worktree.sh`, and the app shows them. (user-originated)
- Starting work means typing a request under "New task": the app creates a worktree named after the task, starts a session in it, and lists it in a sidebar of worktrees, each with its sessions. More sessions can be started in an existing worktree. (agent-proposed, user-approved)
- The app uses an existing checkout of the repository when it finds one or the user points to it. Otherwise it clones into a visible folder the user can change, defaulting to `~/alliance/workspaces/alliance`, so worktrees collect in `~/alliance/workspaces/`. The app's own settings, state and caches go in the platform's application folders (`~/Library/Application Support`, the XDG directories on Linux), never beside the checkout. (agent-proposed, user-approved)
- Each worktree shows its branch, uncommitted changes, unpushed commits, and its PR link with state and CI status. A "Create PR" button sends the agent a prompt to run the repo's review-loop skill. (agent-proposed, user-approved)

## Setup

- The app gets an employee from nothing to a working setup: repository, dependencies, and the developer toolchain, which includes git, Bun, Postgres, `gh` and the Infisical CLI. (user-originated)
- The app checks each setup item itself. A failed check shows its command's own error and a "Fix" button that starts a Claude session instructed to fix that item. (agent-proposed, user-approved)
- The app shows whether the user is signed in to Infisical and can access the project, with a UI to sign in. Secrets follow the Env Var Overhaul project in Linear: local dev and agents get them through `infisical run` against the `dev` environment of the `alliance` project. (user-originated)
- A Settings screen lets the user configure per-user values such as their PostHog key. (user-originated) It saves them as Infisical personal overrides in `dev`, and a placeholder shared secret is added for each such key, since an override needs a shared secret of the same name. (agent-proposed, user-approved)

## Dev servers

- Employees can run the product locally from the app to see their changes. (agent-proposed, user-approved)
- Servers start on demand: each worktree has "Open app" and "Open admin" buttons, which start what that page needs (the server plus the frontend or admin) through `scripts/with-env.sh`, show progress, and open the browser once it responds. An "Open on phone" button starts Expo and shows its QR code, without managing a simulator. A status indicator and a log view are available. Servers stop when their worktree is removed or the app quits. (agent-proposed, user-approved)

## Transcripts

- The sidebar lists local transcripts. A remote transcript the user opens is not added to the sidebar by default. (user-originated)
- A remote transcript in the `alliance-agent-chats` bucket can be opened by its id, and shared between users. (user-originated)
- A remote transcript is read-only: nothing is appended to it, and it cannot be continued or forked into a new session. (user-originated)
- Deleting a transcript in the app never deletes it from the bucket. (user-originated)
- Every employee with access to the `dev` environment of the Alliance's Infisical project can read every transcript in the bucket. The app never writes to another person's transcript. (agent-proposed, user-approved)

## Releases and updates

- Releases are published to GitHub Releases on the public repository. Anyone can download and use a public build; nothing gates sessions on Alliance access, and only Alliance features such as Infisical secrets and remote transcripts need it. (agent-proposed, user-approved)
- The app updates itself: updates download in the background and install on the next restart, and a minimum version blocks older apps until they update. (agent-proposed, user-approved)

## Delivery

- The build is split into many small PRs. (user-originated)
- Running the app's automated tests locally puts no window on the developer's screen. (user-originated)

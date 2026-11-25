---
user: Charles Lien
task: Make the Alliance agent's chat UI much better than its current bare one, add a worktree manager and viewer, and add dev setup (dev dependencies kept up to date, such as Bun and Postgres, AWS SSO login with the right profiles, and anything else local development needs), with research and brainstorming agents advising, and plan the work in Linear
---

This task supersedes, in `docs/provenance/01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first/`, the rule that the chat UI doesn't widen before the thin path runs on both CLIs, for the presentation work listed under Order. In `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/` it supersedes, in the Setup section, the Infisical CLI in the first requirement's toolchain, the requirement that a failed check's "Fix" button starts a Claude session, the Infisical sign-in requirement, and the Infisical parts of the Settings requirement. In its Transcripts section it supersedes the rule that access to the `dev` environment of the Alliance's Infisical project grants reading every transcript, since Infisical no longer gates anything; who reads transcripts is left open (user-originated). The rest of that requirement, that the app never writes to another person's transcript, stands. The Releases requirement, which names Infisical secrets among the Alliance features, is left as written.

## Order

- The chat UI's presentation work starts before the Codex adapter's thin path (send, streamed text, one tool call, interrupt and resume on both pinned CLIs) works. That work is Markdown rendering of agent answers, the visual shell, a task header, the composer's layout, and the design of the history view. (agent-proposed, user-approved)
- Chat behaviour that depends on what the CLIs emit or accept waits until the thin path works on both CLIs. That covers the message queue, attachments, the model and effort picker, grouping of tool activity, the changes card, and loading saved history from either CLI. (agent-proposed, user-approved)

## Messages sent while the agent works

- A message sent while the agent works joins a visible queue, labelled "Send after this reply", in which each message can be edited or removed. Queued messages are sent in order, each after the turn before it ends. (agent-proposed, user-approved)
- The queue pauses when a turn fails, is stopped, or loses its session, and stopping never sends a queued message by itself. (agent-proposed, user-approved)
- A "Stop and send now" action stops the turn and sends the chosen message, leaving the rest of the queue paused. (agent-proposed, user-approved)
- The queue is kept in the app's main process with its conversation, so reloading the window neither loses nor resends a queued message. (agent-proposed, user-approved)
- Sending into a running turn (steering) is offered only once both pinned CLIs are shown to support it. (agent-proposed, user-approved)

## Worktrees

- Each task has one worktree. "New task" creates a worktree; "New conversation in this task" starts another conversation in the task's existing worktree. Setup sessions run without a task worktree. (agent-proposed, user-approved)
- Creating a task's worktree starts as soon as the task is typed, and the app shows the creation's progress. (agent-proposed, user-approved)
- "Archive" is the everyday way to finish a task. It hides the task and keeps its folder, branch, databases and conversations, so restoring it is immediate. It neither commits nor pushes. (agent-proposed, user-approved)
- "Delete workspace and local data" is a separate action. Before it runs, it shows a preview that the worktree scripts produce, listing every descendant worktree, uncommitted and untracked files, commits not on any remote, branches and databases it will delete, with Cancel focused by default. Its scope is checked again, under the scripts' lock, when it runs. (agent-proposed, user-approved)
- The app never deletes a worktree automatically, and never deletes one the app didn't create. (agent-proposed, user-approved)

## Setup

- Setup shows readiness per capability, each saying what the user can do now and what a missing item blocks. (agent-proposed, user-approved) The capabilities and their items:
  - Chat: the agent CLI and its sign-in. Saved conversations stay readable while signed out.
  - Tasks and worktrees: git, Bun at the repository's exact pinned version, Node at the repository's minimum, PostgreSQL 17 running with its client tools (`psql`, `createdb`, `dropdb`, `pg_dump`), migrations applied, and Perl.
  - Pull requests: `gh` signed in with push access to the repository.
  - Alliance services: the AWS CLI with the `alliance-dev` IAM Identity Center profile signed in, checked by actually reading the parameters and transcript bucket it grants.
  - Preview: the selected worktree's server answers its database health check (`GET /health/db`), not merely an open port.
  - Optional capabilities, each turned on when needed: PostHog key, mobile, staging data.
- The `alliance-admin` AWS profile appears in setup. An employee without it sees it as not turned on, never as a problem or failure. (user-originated)
- "Up to date" means matching the versions the repository pins, never the newest release. Setup never upgrades tools in the background and never upgrades PostgreSQL's major version. (agent-proposed, user-approved)
- Known failures are repaired by fixed actions, each followed by the item's check again: "Sign in to AWS" (`aws sso login --profile alliance-dev`), "Start Postgres", "Install dependencies", "Run migrations", "Sign in to Claude" and "Sign in to GitHub". An item passes only when its check passes, never because an agent said it fixed it. (agent-proposed, user-approved)
- The Pull requests item tells its failures apart, each with its own fix, and passes only when its check passes again. (agent-proposed, user-approved)
  - Signed out: "Sign in to GitHub" runs `gh auth login --web --hostname github.com --git-protocol https`. The app opens the system browser itself, never an embedded web view, and shows the one-time code with a copy button, with actions to cancel and to retry.
  - The wrong account active: "Switch account" (`gh auth switch`), offered before signing in again.
  - A permission missing from the token: refreshes just that permission with `gh auth refresh`, without signing in again.
  - Signed in but unable to push: "Signed in as @<login>, who can't push to the repository", with copyable text asking an admin for access, "Use another account" and "Check again". The app never forks the repository silently.
  - A network or unknown error is never shown as needing an admin.
  - The check confirms that `git push` to the repository can authenticate with the same credentials and environment the agent uses, not only that GitHub grants the permission.
- An item that depends on a failed one shows "Blocked" rather than a failure of its own. (agent-proposed, user-approved)
- A repair that destroys data, such as reinstalling Postgres or cloning the repository again, is a separate, named action that asks for confirmation. (agent-proposed, user-approved)
- A failure the fixed actions don't cover offers "Investigate with agent" once an agent works, starting a session given the check's redacted output. "Copy diagnostics" is always available. (agent-proposed, user-approved)
- The Settings screen keeps per-user values, such as the PostHog key, with the repository's current personal-key mechanism rather than Infisical personal overrides, and adds no placeholder shared secrets. (agent-proposed, user-approved)

## Planning

- Each PR has one Linear issue in the "Alliance agent desktop app" project, written as one user-visible change with its tests. (agent-proposed, user-approved)
- Existing issues are reused where they fit. ALL-2035 is split into a viewer, create and archive issue, and a separate guarded-deletion issue. ALL-2034 and ALL-2041 are rewritten for this task's requirements. Issues whose outcome no longer exists, such as ALL-2044's keys in Infisical, are canceled with a comment linking the work that replaced them. New issues cover the chat presentation pass and the message queue. (agent-proposed, user-approved)
- The work is grouped into three stages: chat, worktrees and setup. (agent-proposed, user-approved)

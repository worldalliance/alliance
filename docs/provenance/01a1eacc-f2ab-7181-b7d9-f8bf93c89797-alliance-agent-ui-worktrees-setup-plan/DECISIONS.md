---
user: Charles Lien
task: Make the Alliance agent's chat UI much better than its current bare one, add a worktree manager and viewer, and add dev setup (dev dependencies kept up to date, such as Bun and Postgres, AWS SSO login with the right profiles, and anything else local development needs), with research and brainstorming agents advising, and plan the work in Linear
---

## How the options were found

Each open question went to three subagents before the user answered: a brainstormer with a loose prompt, a researcher looking for established practice, and a second opinion from Codex. Their findings are in EVIDENCE.md. No formal standard settles any of the questions beyond the OAuth rules GitHub sign-in follows; the requirements rest on vendor documentation, common practice, those rules and two studies (EVIDENCE.md).

## Secrets: AWS replaces Infisical in setup

`docs/provenance/01a1c17a-5e56-7000-9532-6e9b2f682623-local-dev-parameter-store/` moved local secrets to AWS Parameter Store, read with each person's `alliance-dev` IAM Identity Center login, and already supersedes the desktop plan's Secrets migration section. So setup's sign-in item is that login, and setup has no Infisical CLI or Infisical sign-in item (agent decision, following REQUIREMENTS.md Setup). Three credential paths stay distinct rather than becoming one "AWS" item: server secrets through `scripts/with-secrets.sh server`, Linear through `scripts/with-secrets.sh devtools`, and transcript uploads through the same login in `agents/chats/chats.ts`.

The user left open who reads transcripts once REQUIREMENTS.md superseded the Infisical audience in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Every member of the `alliance-dev` group, whose permission set grants the transcript bucket (reconstructed from `terraform/identity-center.tf` on `main`), reads every transcript (agent decision: the user deferred who reads them, not whether they are readable). That permission set also allows writing any object in the bucket, so "the app never writes to another person's transcript" stays app behaviour that AWS doesn't enforce (reconstructed from the same file; filed as separate work, not changed here).

The same spec's Releases requirement names "Infisical secrets" among the Alliance features that need Alliance access. This task reads it as Alliance secrets, which now come from Parameter Store through the `alliance-dev` login, and doesn't supersede it (agent decision).

## Order: where the presentation pass stops

The presentation pass consumes only the existing session interface and adds no event types to `agents/desktop/src/main/agent/session.ts` or `src/shared/agent-event.ts` (agent decision). A change that needs a new event type or session method belongs after the Codex thin path, so the shared interface isn't shaped by one CLI. The history view's layout is designed in the pass; loading saved history from a CLI's transcripts waits, and joins the local transcript viewer (ALL-2039) rather than becoming a second transcript system.

## Queue

A paused queue resumes only when the user acts. It shows why it paused, a "Resume queue" action, and each message's "Send now", edit and remove; reconnecting, signing in or a successful later turn never resumes it by itself (agent decision: the user deferred how the queue resumes). Warp resumes by itself after a clean response (EVIDENCE.md, Chat), but here a queued instruction goes to an agent with permissions off, so it waits for the user.

`AgentSession.send` rejects a send while a turn runs, and the Claude backend enforces it (reconstructed from code on `main`), so the queue sits in the main process in front of `send`, not in the renderer alone. If the app can't tell whether a queued message was delivered, as after a crash, it shows the message as unsent and asks, rather than resending it (agent decision): resending an instruction to an agent with permissions off can repeat its effects.

## Worktree deletion

`scripts/rm-worktree.sh` removes with `rm -rf`, prune and `git branch -D`, so git's own refusal to remove a dirty worktree (`git worktree remove` without `--force`) doesn't protect this app's users. The first research report suggested leaving that refusal to git; the second opinion corrected it (EVIDENCE.md, Worktrees).

The deletion preview and the scope check live in the worktree scripts, beside their ownership records and lock, as a machine-readable mode of the script that deletes, not as a second implementation in TypeScript (agent decision). A preview computed only in the app can go stale before a name-based recursive delete runs. A partial deletion reports what remains and offers to finish it, since the script can delete some resources and exit nonzero.

The viewer and Archive ship before deletion, which needs the script change first (agent decision).

The user deferred how "never deletes one the app didn't create" applies to descendants the worktree scripts record under a task's worktree; the requirement itself stands. The agent reads it this way (agent decision): the app deletes only after the user confirms "Delete workspace and local data", and only the task's worktree and the descendants the scripts record under it, each named in the preview with what it would lose. It never touches a worktree outside its tasks, such as a checkout made in a terminal. A descendant whose ownership the records can't establish blocks the deletion, and the preview says which one. The research behind the requirement concerned automatic cleanup only (EVIDENCE.md, Worktrees).

## A new task's base

A new task's worktree is a sibling created from the main checkout, branched from a freshly fetched `origin/main`, as the desktop plan already decided; a child of another worktree is only for an explicitly dependent task (agent decision, following the second opinion). A child starts from its parent's last commit, not its uncommitted work, and gets the main checkout's database, so the app doesn't describe it as a copy of its parent.

Creation starts when the user sends the task from "New task", not while it is being typed, so an unsent draft leaves no worktree (agent decision: the user deferred how "as soon as the task is typed" in REQUIREMENTS.md Worktrees is read; EVIDENCE.md, Worktrees). The first message is kept and held until the worktree is ready. If creation fails, the message is kept and the app says what was partly created. No spare worktree is kept in reserve.

## Setup

Setup sessions started by "Investigate with agent" appear in the sidebar's "Setup" group that the desktop plan placed above the worktrees (agent decision, carrying over the plan's placement for its Fix sessions).

"The agent CLI" in the Chat capability means each bundled CLI. Codex's items, its sign-in and the trust of the repository's hooks that the desktop plan's setup checks (`docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/DECISIONS.md`), join setup with the Codex adapter, with a "Sign in to Codex" action beside "Sign in to Claude". This task doesn't supersede the hook-trust check (agent decision).

Alliance services also checks Python 3 as its own item, since `scripts/with-secrets.sh` runs it (EVIDENCE.md, What local development needs on `main`); otherwise a missing Python reads as an AWS failure that "Sign in to AWS" can't fix. The check runs `python3` rather than only finding it, because macOS ships a `/usr/bin/python3` that only offers to install the Command Line Tools (agent decision).

The Pull requests item departs from the common fork fallback (EVIDENCE.md, Signing in to GitHub) because staff fix missing push access through an admin, and a fork would take their work away from the repository's CI and reviewers. The agent's `gh pr create` passes `--head`, so `gh` never forks by itself. "Sign in to GitHub" requests `gh`'s default scopes; a push rejected for a missing scope, such as `workflow` for a change to `.github/workflows`, is the missing-permission case (agent decision).

When `gh` is signed in with push access but `git push` can't authenticate, git isn't using `gh`'s credentials, which `gh auth setup-git` configures separately (EVIDENCE.md, Signing in to GitHub). That is a known failure with its own fixed action, "Set up Git", which runs `gh auth setup-git` and then the check again, and "Sign in to GitHub" runs `gh auth setup-git` after signing in, so a fresh sign-in leaves git working (agent decision, within the approved check that `git push` can authenticate).

Checks run where the app's agents run: the main process's environment and the `PATH` it gives its children, since a binary a login shell finds may not be on the `PATH` of an app launched from Finder (agent decision).

Bun and the bundled CLIs are checked against exact versions; tools installed through Homebrew or the OS are checked against the repository's minimum or major version, since Homebrew can't pin arbitrary versions (agent decision; EVIDENCE.md, Setup).

`alliance-admin` is checked only for whether the profile exists and signs in. Without it, setup shows "Not turned on", in neutral styling, with no action other than a short line saying an admin grants it (agent decision, following REQUIREMENTS.md Setup).

## Linear

Stages are project milestones in the existing "Alliance agent desktop app" project, not new projects, so its blocking relations and history stay in one place (agent decision). An issue already Done keeps its history and gets a successor issue rather than a rewrite. Before filing, each new issue is checked against the project's existing issues, per the Linear skill.

## Separate work

Found during research and not changed here:

- `README.md` says the server has its own lockfile, and the root `AGENTS.md` says every web package installs from `apps/frontend/package.json`, but `main` has one root `bun.lock` that includes the server (reconstructed from files on `main`).
- `server/scripts/test-in-container.sh` exports `DATABASE_URL` and `PG*`, while `server/src/datasources/dataSourceTest.ts` reads `DB_*` and a hard-coded port 5432 (reconstructed from files on `main`).
- The transcript bucket's write permission, above.

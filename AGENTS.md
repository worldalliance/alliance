# This repo

This repository is open source.

The project is the Alliance, and `alliance` is its identifier wherever a name carries one: packages, bundle ids, URL schemes, databases, env vars, services. `worldalliance` (GitHub org, Linear workspace, legacy domain), `thealliance` (domain, Apple Services ID), and `alliancefoundation` (iOS bundle ids, Expo account) exist only where `alliance` was taken; reference those existing things by their real names, and name new things `alliance`. That holds for a new Apple identifier too: it falls back to the existing prefix only if `alliance` is taken, even when that leaves related ids with different prefixes (`com.alliance.alliancemobile.<variant>` beside `com.alliancefoundation.alliancemobile`).

## Packages

- `server/`: backend, NestJS
- `apps/frontend/`: web, React
- `apps/admin/`: admin panel, React
- `apps/mobile/`: mobile, React Native
- `sharedweb/`: shared by admin + frontend
- `shared/`: shared by admin + frontend + mobile
- `common/`: shared by all apps + server
- `kora-review/`: KORA's transcript review tool, mounted by frontend; its schemas and converter are used by server
- `agents/`: skills and hooks for the coding agents
- `agents/desktop/`: Alliance agent, the desktop app employees work with coding agents through

## Nested AGENTS.md

Working under `server/**` → read `server/AGENTS.md`; under `apps/**` → `apps/AGENTS.md`. Those are the only nested ones.

## Local secrets

Commands that need secrets go through `scripts/with-secrets.sh`, using the person's AWS login. Login or setup failure → `docs/local-secrets.md`.

## Worktree

If @.worktree/AGENTS.md exists, read it.

Create every worktree with `scripts/new-worktree.sh <name>`, from the main checkout or a worktree it created. The script gives each one its own ports and database and records it, so removal finds everything it owns; a plain `git worktree add` or a harness's worktree isolation gets none of that. Tell an agent you hand a worktree to read that worktree's `.worktree/AGENTS.md`, since one started from your checkout has your checkout's ports in context. `scripts/rm-worktree.sh <name>` removes a worktree with its descendants, deleting their uncommitted work and the branches the script created, unpushed commits included. Commit and push what should outlive it.

## Skills

Always read and apply:

- `(root)/agents/skills/trim-comments/SKILL.md` → every comment your change adds or touches, before you present the change.

Read before the matching task:

- Making a repository change intended to be kept, or determining the provenance of anything in the repository → `(root)/agents/skills/provenance/SKILL.md`
- Implementing a feature, fixing a bug, or refactoring code → `(root)/agents/skills/implement/SKILL.md`
- Verifying any change, including docs, skills, scripts, workflows, and reviews → **Checks** in `(root)/agents/skills/implement/SKILL.md`
- Pulling PostHog session replays or other PostHog API data → `(root)/agents/skills/posthog/SKILL.md`
- Querying the local Postgres db → `(root)/agents/skills/local-db/SKILL.md`
- Using the Linear API, naming a branch for a Linear issue, or writing a commit or PR that names one → `(root)/agents/skills/linear/SKILL.md`
- Finishing a branch, once its work is done and its checks pass and before pushing or opening its PR, or when its PR's CI fails → `(root)/agents/skills/review-loop/SKILL.md`. Skip it when `REVIEW_LOOP_ROLE` is set.
- Spawning a subagent, which goes through the `claude` or `codex` CLI in place of your harness's built-in agent tool → `(root)/agents/skills/subagents/SKILL.md`
- Verifying a change in the browser, driving the mobile app, calling the API, or authenticating as an admin → `(root)/agents/skills/playwright/SKILL.md`
- Designing or changing UI in `apps/`, `sharedweb/`, `shared/` or `agents/desktop`, or judging a UI's quality → `(root)/agents/skills/ux-guidelines/SKILL.md`
- Changing a form, a native screen, keyboard shortcuts, loading or URL state, or choosing colour, type, spacing or motion values, in those folders, or judging a UI's quality → `(root)/agents/skills/ux-forms-platform/SKILL.md`
- Writing or editing any doc an agent reads (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, docs those point at) → `(root)/agents/skills/writing-for-agents/SKILL.md`

## Typechecking

`bun run typecheck` from inside a package; the repo root has no such script. Each package's script picks the right config (`tsconfig.typecheck.json` where shared sources need pulling in directly). Never bare `tsc`, even with `--noEmit`.

## Dependencies

Non-standard workspace: every web package installs from `apps/frontend/package.json`. A dependency used in `apps/admin`, `sharedweb`, `common`, … must also be declared there, same version range. `bun install` after editing. `agents/desktop` is the exception: it declares its own dependencies and installs from its own lockfile, so removing it is deleting the folder plus the few root edits `agents/README.md` points to.

Reach for a maintained npm package over hand-rolling parsing, sanitization, date handling, retries. Inside the repo, reuse or extract a shared util instead of duplicating one.

## Established practice

Prefer established standards and widely adopted practices that fit the stack and task. Research before choosing when the applicable practice is unclear, unfamiliar, or may have changed, starting with standards bodies and vendor documentation. Distinguish formal standards, vendor recommendations (official guidance from a platform, framework or library), research-backed practice (supported by published empirical studies, such as usability research), and common practice; cite sources for researched choices, and when the task has a provenance directory, record the research there in `EVIDENCE.md`. Explicit requirements and concrete compatibility constraints take precedence. Explain material departures from established practice and the constraint that warrants them.

Label every recommendation, number and claim shown to the owner in chat as researched (name the research page or source and what it actually checked) or agent judgement. A recommendation on a research page can still be agent judgement; say which.

## Breaking changes

Change a shape by expand-migrate-contract when something depending on it can't switch at the same moment: stored or in-flight data, running or installed clients, other services, code outside the change. Adopting a rule existing code breaks takes the same steps, with the code that breaks it as the old shape.

1. Old shape only.
2. Expand reads: read both shapes.
3. Expand writes: support writing the new shape.
4. Ratchet: remove writing the old shape and block it from coming back, so every new write uses the new one.
5. Migrate: move each existing old-shape item to the new shape.
6. Contract: remove the old shape, reads included.

Each step starts once the previous one is live everywhere that depends on it, installed clients included (shown by a forced minimum version or by no traffic from older builds); consecutive steps may ship together only where they land atomically, and a database migration and the server deploy land at different times.

Mark a fallback awaiting its contract step `BACKCOMPAT(<tag>)` with the condition for removing it.

## Capitalisation

User-facing titles, headings, buttons, menu items, tabs and labels capitalise only the first word and proper nouns: "Try again", not "Try Again". This holds in every channel, emails and notifications included, and on every platform, iOS and macOS included, where Apple's guidance for some elements, such as buttons, uses title case.

## Issue tracking

Issues live in Linear.

# General

## Git

Ask before running a git command that writes. Read-only ones (`git diff`, `git status`, `git log`) need no permission.

## Questions

Follow the user's intended request in context. Requests to explain, evaluate, compare, or justify authorize investigation and an answer; they do not by themselves authorize changes. Requests to perform work authorize that work, including when phrased as questions. Asking about a recommendation neither rejects it nor approves an alternative.

For example, after you suggest X, "Why X?" asks you to explain your reasoning. It does not mean the user is against X. Explain the recommendation and revise it only where the reasoning fails.

## Open questions

A question whose answer will be recorded in provenance, such as a product decision or a choice between approaches, goes in one numbered plain-text message, not a structured question tool, and asks only what the code can't answer. Open each question with its context, written for a reader who hasn't followed the work: what it is about, where it comes up, and what hangs on the answer. Give it lettered options, each with what it has going for it: your recommendation first, then alternatives, then "I don't care". Open the message by saying that picking an option or answering in their own words makes it a requirement later agents must keep, while "I don't care" leaves the choice to the agent, which may switch if its pick causes friction. Keep asking as answers uncover more decisions, until none is open. Other questions, such as asking permission to run a command, stay plain.

## Fail loudly

Prefer to fail loudly over silently.

For example, a form with any schema error should not render. Otherwise a user fills it out without knowing it's broken.

## Enum branching

Enums over string-literal unions for closed sets of named variants.

Branching on a closed set (enum, literal union, tagged `kind`) takes one of two forms, so a variant added later fails the build instead of shipping a silently missing branch. An exhaustive `switch`, where `satisfies never` is what forces exhaustiveness:

```ts
default:
  throw new Error(`unknown kind: ${kind satisfies never}`);
```

The throw is optional: `default: kind satisfies never; return null;` is fine when an older client should ignore new variants.

Or a `Record<MyEnum, T>` lookup, which forces every variant to be listed. Both forms apply even to two-variant enums. For a rule that covers only some variants, a `Record<MyEnum, boolean>` makes each new variant a compile error until someone opts it in or out.

## Function arguments

Three or more parameters → a single `params`/`input` object. One or two are usually fine positionally, but name them when they're same-typed or boolean. `slice(start, end)` reads; `move(sourceId, targetId)` doesn't.

## Comments

Default to none. Add one only for a non-obvious constraint, rationale, invariant, or edge case the code can't express, stated in the present tense.

## Type casts

Avoid `as`. Fix types at the source, validate with zod at trust boundaries, or use `satisfies`. Unavoidable cast: keep it narrow, comment why it's safe. `as const` fine. Never `as any` or `x as unknown as T`.

## Result type

Operations that can fail (parsing, validation, fallible IO) return `Result<T, E>` from `common/src/result.ts` instead of throwing or returning `null`/`undefined`. Type and helper namespace import separately:

```ts
import { R, type Result } from "@alliance/common/result";
```

Use the `R.*` helpers (`R.fromPromise`, `R.match`, …) rather than hand-rolling `{ ok, ... }`. Throwing is still right where the framework expects it, e.g. NestJS controllers behind exception filters.

## Secrets and personal information

Secrets stay in the environment, out of context. Read `.env*` files through a filter that redacts values; to use a secret, pipe it into the command from a script.

This repository is open source, so anything written in it may become public: redact what shouldn't be public. Information anyone viewing the repository can already see needs none, such as contributors' names and handles on their commits, or identifying information deliberately used for authorship, credit, or project responsibility. Committing secrets or incidental personal information doesn't exempt them: they still get redacted, even in an earlier task's provenance. Redact secrets and incidental personal information as `[redacted]` before writing repo files or capturing artifacts, including provenance, ignored files, and `.scratch/` artifacts. The session transcripts the `agents/chats/` hooks upload to their private bucket stay raw. Use synthetic data for fixtures and examples. Database dumps, staging's included, stay out of commits, in `.scratch/` or an ignored `db_dumps/`. Before handing off, check every file you created or changed for secrets and incidental personal information.

## Working files

Put working files in `.scratch/`: notes, scripts, logs, dumps, downloads. Never `/tmp` or `~`. When reading, prefer files in the repo over ones elsewhere on the machine.

## Stopping processes

Stop a process by its PID. Without one, list the candidates with `pgrep -fl '<pattern>'` (`pgrep -af` on Linux, where `-l` prints only the process name), options before the pattern, and stop only the PIDs you checked. Send a plain SIGTERM and wait for the exit, escalating to SIGKILL only when it outlives longer than expected.

## Less is more

Follow YAGNI. Prefer one-liners. An abstraction earns its place at the second caller, a config option at the first person who sets it, an error branch at a state that can occur.

## File size

Aim for hand-written source files, tests included, well under 500 lines. The 500 is this repo's own threshold, not an external standard: agents read files whole, so a file should hold what one task needs. When your change adds to a file and would leave it past 500 non-blank lines with no waiver, or past the ceiling its waiver records, first ask a codex subagent (`(root)/agents/skills/subagents/SKILL.md`) with `-s read-only` in place of `--dangerously-bypass-approvals-and-sandbox`, naming only the file and not your change, for a few splits along cohesive boundaries. Apply the one you judge best, or keep the file whole when it is one cohesive unit, which any task touching it would read in full after a split too: put `/* alliance/max-lines <ceiling> -- <why it is one unit> */` at its top, or raise the ceiling in its waiver and revise the reason. The ceiling is the non-blank line count, waiver line included, rounded up to a multiple of 50, so small changes within that band leave the waiver alone. Where `/* */` isn't a comment, write the waiver in the language's own comment syntax. A `baseline:` reason marks a file that was past the limit before waivers existed, so growing it past its ceiling means a split or a real reason. The `alliance/max-lines` lint error, which each package's `typecheck` runs, enforces the ceiling on the TypeScript those lint runs cover; other hand-written files follow this rule without it.

Generated files, migrations, lockfiles, snapshots, fixture data, data files, workflow YAML, config, and docs other than agent instructions have no line limit. Name generated TypeScript `*.gen.ts`; the lint skips those and `migrations/`. Give any other such file the lint flags a waiver whose reason names its category, and raise its ceiling as the file grows, skipping the codex step.

## Scope and improvement

Improve the code and agent instructions involved in the task when there is a concrete benefit and the resulting change remains coherent, reviewable, and verifiable. Report unrelated opportunities for separate work. Judge existing implementations by current requirements and evidence.

Delete what your change orphaned: the import, variable, or function nothing calls now.

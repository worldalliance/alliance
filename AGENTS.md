# This repo

This repository is open source.

## Packages

- `server/`: backend, NestJS
- `apps/frontend/`: web, React
- `apps/admin/`: admin panel, React
- `apps/mobile/`: mobile, React Native
- `sharedweb/`: shared by admin + frontend
- `shared/`: shared by admin + frontend + mobile
- `common/`: shared by all apps + server

## Nested AGENTS.md

Working under `server/**` → read `server/AGENTS.md`; under `apps/**` → `apps/AGENTS.md`. Those are the only nested ones.

## Worktree

If @.worktree/AGENTS.md exists, read it.

Create every worktree with `scripts/new-worktree.sh <name>`, from the main checkout or a worktree it created. The script gives each one its own ports and database and records it, so removal finds everything it owns; a plain `git worktree add` or a harness's worktree isolation gets none of that. Tell an agent you hand a worktree to read that worktree's `.worktree/AGENTS.md`, since one started from your checkout has your checkout's ports in context. `scripts/rm-worktree.sh <name>` removes a worktree with its descendants, deleting their uncommitted work and the branches the script created, unpushed commits included. Commit and push what should outlive it.

## Skills

Always read and apply:

- `(root)/skills/trim-comments/SKILL.md` → every comment your change adds or touches, before you present the change.

Read before the matching task:

- Making a repository change intended to be kept, or determining the provenance of anything in the repository → `(root)/skills/provenance/SKILL.md`
- Implementing a feature, fixing a bug, or refactoring code → `(root)/skills/implement/SKILL.md`
- Verifying any change, including docs, skills, scripts, workflows, and reviews → **Checks** in `(root)/skills/implement/SKILL.md`
- Pulling PostHog session replays or other PostHog API data → `(root)/skills/posthog/SKILL.md`
- Querying the local Postgres db → `(root)/skills/local-db/SKILL.md`
- Using the Linear API → `(root)/skills/linear/SKILL.md`
- Spawning a subagent, which goes through the `claude` or `codex` CLI in place of your harness's built-in agent tool → `(root)/skills/subagents/SKILL.md`
- Verifying a change in the browser, driving the mobile app, calling the API, or authenticating as an admin → `(root)/skills/playwright/SKILL.md`
- Writing or editing any doc an agent reads (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, docs those point at) → `(root)/skills/writing-for-agents/SKILL.md`

## Typechecking

`bun run typecheck` from inside a package; the repo root has no such script. Each package's script picks the right config (`tsconfig.typecheck.json` where shared sources need pulling in directly). Never bare `tsc`, even with `--noEmit`.

## Dependencies

Non-standard workspace: every web package installs from `apps/frontend/package.json`. A dependency used in `apps/admin`, `sharedweb`, `common`, … must also be declared there, same version range. `bun install` after editing.

Reach for a maintained npm package over hand-rolling parsing, sanitization, date handling, retries. Inside the repo, reuse or extract a shared util instead of duplicating one.

## Established practice

Prefer established standards and widely adopted practices that fit the stack and task. Research before choosing when the applicable practice is unclear, unfamiliar, or may have changed, starting with standards bodies and official framework or library documentation. Distinguish formal standards, common practice, and vendor recommendations; cite sources for researched choices. Explicit requirements and concrete compatibility constraints take precedence. Explain material departures from established practice and the constraint that warrants them.

## Issue tracking

Issues live in Linear.

# General

## Git

Ask before running a git command that writes. Read-only ones (`git diff`, `git status`, `git log`) need no permission.

## Questions

Follow the user's intended request in context. Requests to explain, evaluate, compare, or justify authorize investigation and an answer; they do not by themselves authorize changes. Requests to perform work authorize that work, including when phrased as questions. Asking about a recommendation neither rejects it nor approves an alternative.

For example, after you suggest X, "Why X?" asks you to explain your reasoning. It does not mean the user is against X. Explain the recommendation and revise it only where the reasoning fails.

## Open questions

A question whose answer will be recorded in provenance, such as a product decision or a choice between approaches, goes in one numbered plain-text message, not a structured question tool, and asks only what the code can't answer. Give each question lettered options: your recommendation first, then alternatives, then "I don't care". Open the message by saying that picking an option or answering in their own words makes it a requirement later agents must keep, while "I don't care" leaves the choice to the agent, which may switch if its pick causes friction. Keep asking as answers uncover more decisions, until none is open. Other questions, such as asking permission to run a command, stay plain.

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

## UI affordances

Icons and direct interaction over words: a `lucide-react` icon button (`lucide-react-native` on mobile) over a text button, an inline edit over an "Edit" mode toggle. Text labels only where nothing else reads unambiguously.

Icon-only controls carry a tooltip or `aria-label`. Destructive or irreversible actions say what they do in words.

## Secrets and personal information

Secrets stay in the environment, out of context. Read `.env*` files through a filter that redacts values; to use a secret, pipe it into the command from a script.

Preserve identifying information deliberately used for authorship, credit, or project responsibility. Redact secrets and incidental personal information as `[redacted]` before writing repo files or capturing artifacts, including provenance, ignored files, and `.scratch/` artifacts. Use synthetic data for fixtures and examples. Before handing off, check every file you created or changed for secrets and incidental personal information.

## Working files

Put working files in `.scratch/`: notes, scripts, logs, dumps, downloads. Never `/tmp` or `~`. When reading, prefer files in the repo over ones elsewhere on the machine.

## Less is more

Follow YAGNI. Prefer one-liners. An abstraction earns its place at the second caller, a config option at the first person who sets it, an error branch at a state that can occur.

## File size

Aim for files well under 500 lines to help optimize this codebase for coding agents. A file past 500 is already overdue for a split. When your change adds to a file and would leave it past that, split the file first: ask a codex subagent (`(root)/skills/subagents/SKILL.md`) with `-s read-only` in place of `--dangerously-bypass-approvals-and-sandbox`, naming only the file and not your change, for a few splits along cohesive boundaries, then apply the one you judge best.

## Scope and improvement

Improve the code and agent instructions involved in the task when there is a concrete benefit and the resulting change remains coherent, reviewable, and verifiable. Report unrelated opportunities for separate work. Judge existing implementations by current requirements and evidence.

Delete what your change orphaned: the import, variable, or function nothing calls now.

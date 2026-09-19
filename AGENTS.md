# This repo

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

## Skills

Always read and apply:

- `(root)/skills/trim-comments/SKILL.md` → every comment your change adds or touches, before you present the change.

Read before the matching task:

- Determining the provenance of anything in the repository → `(root)/skills/provenance/SKILL.md`
- Implementing a feature, fixing a bug, or refactoring code → `(root)/skills/implement/SKILL.md`
- Querying the local Postgres db → `(root)/skills/local-db/SKILL.md`
- Using the Linear API → `(root)/skills/linear/SKILL.md`
- Verifying a change in the browser, driving the mobile app, calling the API, or authenticating as an admin → `(root)/skills/playwright/SKILL.md`
- Writing or editing any doc an agent reads (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, docs those point at) → `(root)/skills/writing-for-agents/SKILL.md`

## Typechecking

`bun run typecheck` from inside a package; the repo root has no such script. Each package's script picks the right config (`tsconfig.typecheck.json` where shared sources need pulling in directly). Never bare `tsc`, even with `--noEmit`.

## Formatting

`bun run format [FILE...]` from the repo root, all files when none are named; `bun run format:check [FILE...]` to only report.

## Workflows

`actionlint` from the repo root after editing `.github/workflows/`; CI and deploys fail on its findings. Without `shellcheck` on `PATH` it skips the shell in `run:` blocks and still passes; `brew install actionlint shellcheck`.

`shellcheck .github/actions/*/*.sh` after editing `.github/actions/`; actionlint skips those scripts, and CI and deploys run it too.

## Testing

`bun run test` from the repo root; scope by package: `bun run test apps/admin sharedweb`. From inside a package, run bare `bun test`.

## Dependencies

Non-standard workspace: every web package installs from `apps/frontend/package.json`. A dependency used in `apps/admin`, `sharedweb`, `common`, … must also be declared there, same version range. `bun install` after editing.

Reach for a maintained npm package over hand-rolling parsing, sanitization, date handling, retries. Inside the repo, reuse or extract a shared util instead of duplicating one.

## Issue tracking

Issues live in Linear.

# General

## Git

Ask before running a git command that writes. Read-only ones (`git diff`, `git status`, `git log`) need no permission.

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

Never write secrets or real personally identifiable information into any repo file, including provenance, ignored files, and `.scratch/` artifacts. Redact sensitive values as `[redacted]` before writing text or capturing artifacts; use synthetic data for fixtures and examples. Before handing off, check every file you created or changed for secrets and personal information.

## Working files

Put working files in `.scratch/`: notes, scripts, logs, dumps, downloads. Never `/tmp` or `~`. When reading, prefer files in the repo over ones elsewhere on the machine.

## Less is more

Follow YAGNI. Prefer one-liners. An abstraction earns its place at the second caller, a config option at the first person who sets it, an error branch at a state that can occur.

## File size

Aim for files under ~500 lines to help optimize this codebase for coding agents. When your change adds a separable unit (subcomponent, hook, helper) to a file past that, put the unit in its own file. Split along cohesive boundaries; a file doing one thing may run longer.

## Surgical changes

Every changed line traces to the request. Adjacent code keeps its style, its formatting, and its comments, even where you would write it differently.

Delete what your change orphaned: the import, variable, or function nothing calls now. Leave dead code that was already there, and name it in your response.

## Success criteria

State the check that decides the task is done, then loop until it passes. A bug fix starts with a test that reproduces the bug. A refactor runs the suite green before and after. Adding validation means tests for the invalid inputs, then the code that passes them.

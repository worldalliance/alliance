## Packages

- `server/` — backend (NestJS)
- `apps/frontend/` — web (React)
- `apps/admin/` — admin panel (React)
- `apps/mobile/` — mobile (React Native)
- `sharedweb/` — shared by admin + frontend
- `shared/` — shared by admin + frontend + mobile
- `common/` — shared by all apps + server

## Nested AGENTS.md

Working under `server/**` → read `server/AGENTS.md`; under `apps/**` → `apps/AGENTS.md`. Those are the only nested ones.

## Git

Ask before running a git command that writes. Read-only ones (`git diff`, `git status`, `git log`) need no permission.

## Skills

Always read `(root)/skills/unslop/SKILL.md` and apply its rules to everything you write.

Read before the matching task:

- Querying the local Postgres db → `(root)/skills/local-db/SKILL.md`
- Verifying a change in the browser, calling the API, or authenticating as an admin → `(root)/skills/playwright/SKILL.md`
- Writing or editing any doc an agent reads (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, docs those point at) → `(root)/skills/writing-for-agents/SKILL.md`

## Typechecking

`bun run typecheck` — per-package, not at the repo root; resolves the right config per package (`tsconfig.typecheck.json` where shared sources need pulling in directly). Never bare `tsc`, even with `--noEmit`.

## Testing

`bun run test` from the repo root; scope by package: `bun run test apps/admin sharedweb`. Bare `bun test` from inside a package.

## Dependencies

Non-standard workspace: every web package installs from `apps/frontend/package.json`. A dependency used in `apps/admin`, `sharedweb`, `common`, … must also be declared there, same version range. `bun install` after editing.

Reach for a maintained npm package over hand-rolling parsing, sanitization, date handling, retries. Same inside the repo — reuse or extract a shared util instead of duplicating one.

## Enum branching

Enums over string-literal unions for closed sets of named variants.

Branching on a closed set (enum, literal union, tagged `kind`) takes one of two forms, so a variant added later fails the build instead of shipping a silently missing branch. An exhaustive `switch`, where `satisfies never` is what forces exhaustiveness:

```ts
default:
  throw new Error(`unknown kind: ${kind satisfies never}`);
```

The throw is optional: `default: kind satisfies never; return null;` is fine when an older client should ignore new variants.

Or a `Record<MyEnum, T>` lookup, which forces every variant to be listed. Applies at two variants, and to subsets, where a `Record<MyEnum, boolean>` makes each new variant a compile error until someone opts it in or out.

## Function arguments

Three or more parameters → a single `params`/`input` object. One or two are usually fine positionally, but name them when they're same-typed or boolean — `slice(start, end)` reads; `move(sourceId, targetId)` doesn't.

## Comments

Default to none. Add one only for a non-obvious constraint, rationale, invariant, or edge case the code can't express, stated in the present tense.

## Type casts

Avoid `as` — fix types at the source, validate with zod at trust boundaries, or use `satisfies`. Unavoidable cast: keep it narrow, comment why it's safe. `as const` fine. Never `as any` or `x as unknown as T`.

## Result type

Operations that can fail (parsing, validation, fallible IO) return `Result<T, E>` from `common/src/result.ts` instead of throwing or returning `null`/`undefined`. Type and helper namespace import separately:

```ts
import { R, type Result } from "@alliance/common/result";
```

Use the `R.*` helpers (`R.fromPromise`, `R.match`, …) rather than hand-rolling `{ ok, ... }`. Throwing is still right where the framework expects it — e.g. NestJS controllers behind exception filters.

## UI affordances

Icons and direct interaction over words: a `lucide-react` icon button (`lucide-react-native` on mobile) over a text button, an inline edit over an "Edit" mode toggle. Text labels only where nothing else reads unambiguously.

Icon-only controls carry a tooltip or `aria-label`, and destructive or irreversible actions say what they do in words.

## Working files

Everything stays inside the repo — scratch files, notes, scripts, logs, dumps, downloads. Never `/tmp` or `~`. Same when reading: prefer files in the repo over things stashed elsewhere on the machine.

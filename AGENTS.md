## Packages

- `server/` — backend (NestJS)
- `apps/frontend/` — web (React)
- `apps/admin/` — admin panel (React)
- `apps/mobile/` — mobile (React Native)
- `sharedweb/` — shared by admin + frontend
- `shared/` — shared by admin + frontend + mobile
- `common/` — shared by all apps + server

## Nested AGENTS.md

Read `server/AGENTS.md` before working under `server/**`, `apps/AGENTS.md` before `apps/**`. Those are the only nested ones.

## Skills

Read before the matching task:

- `.claude/skills/local-db/SKILL.md` — querying the local Postgres db
- `.claude/skills/playwright/SKILL.md` — driving the locally running apps
- `.claude/skills/context-files/SKILL.md` — writing or editing any `SKILL.md`, `AGENTS.md`, `CLAUDE.md`

## Typechecking

`bun run typecheck` — per-package, not at the repo root; resolves the right config per package (`tsconfig.typecheck.json` where shared sources need pulling in directly). Never bare `tsc`, even with `--noEmit`.

## Testing

`bun run test` from the repo root; scope by package: `bun run test apps/admin sharedweb`. Bare `bun test` from inside a package.

## Dependencies

Non-standard workspace: every web package installs from `apps/frontend/package.json`. A dependency used in `apps/admin`, `sharedweb`, `common`, … must also be declared there, same version range. `bun install` after editing.

Reach for a maintained npm package over hand-rolling parsing, sanitization, date handling, retries. Same inside the repo — reuse or extract a shared util instead of duplicating one.

## Enum branching

Enums over string-literal unions for closed sets of named variants.

Never branch on a closed set (enum, literal union, tagged `kind`) with a ternary or open `if`/`else` — a variant added later compiles fine and the missing branch ships silently. Use either an exhaustive `switch`:

```ts
default:
  throw new Error(`unknown kind: ${kind satisfies never}`);
```

`satisfies never` is the load-bearing part; the throw is optional (`default: kind satisfies never; return null;` is fine when an older client should ignore new variants).

Or index into a `Record<MyEnum, T>`, which forces every variant to be listed. Same for subsets — a `Record<MyEnum, boolean>` lookup makes each new variant a compile error until someone opts it in or out. Applies at two variants too.

## Function arguments

Three or more parameters → a single `params`/`input` object. One or two are usually fine positionally, but name them when they're same-typed or boolean — `slice(start, end)` reads; `move(sourceId, targetId)` doesn't.

## Comments

Default to none. Add one only for a non-obvious constraint, rationale, invariant, or edge case the code can't express. Never narrate code, restate names/types/control flow, add decorative headings, or describe past changes.

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

Not a license for mystery meat — icon-only controls need a tooltip or `aria-label`, and destructive or irreversible actions still say what they do in words.

## Working files

Everything stays inside the repo — scratch files, notes, scripts, logs, dumps, downloads. Never `/tmp` or `~`. Same when reading: prefer files in the repo over things stashed elsewhere on the machine.

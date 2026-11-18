# Evidence

## Measurements

### `tsc` and missing values in text (typescript 5.9.3, `strict`, `noUncheckedIndexedAccess`, the formula library from `common/src/forms/formula-lib.ts` as the only lib; 2026-11-12)

Method: a scratch program compiled `declare const s: string | null; declare const n: number | null; declare const list: { a: string | null }[]` and the expressions below, printing every diagnostic with its span.

- `"x" + s` and `` `hi ${s}` `` check clean, so `tsc` lets a nullable value into text.
- `(s === "CA") ?? false` fails with TS2869, located on the left operand `s === "CA"`.
- `list[0].a` fails with TS2532 "Object is possibly 'undefined'"; `isUnknown(list[0]) ? null : list[0].a` checks clean, so `tsc` narrows a repeated literal index after the guard.
- `n + 1` fails with TS18047; `!isUnknown(n) && n > 5` checks clean.

### `tsc` and a comparison with `null` (typescript 5.9.3, the same program and lib; 2026-11-17)

- `s === null`, with `s: string | null`, checks clean, so the ban on `=== null` has to come from the analysis.

### TypeScript's document registry across language services (typescript 5.9.3; 2026-11-12)

Method: two save checks in one process, each a new language service sharing one `ts.createDocumentRegistry()`, writing different text to the same file name at version 1.

- The second check type-checked the first check's text: the registry returns its cached syntax tree for a matching file name and version, whichever service asks. A registry shared that way also keeps every check's files until the process exits, since no service is disposed: a counter around the registry's acquire and release, over one-expression checks, held 4 documents after 1 check, 44 after 11 and 4444 after 1111 (round 18 review, 2026-11-13), and per-check timings with a fresh registry were within noise of the shared one. Each check therefore has its own registry (`check-world.ts`).

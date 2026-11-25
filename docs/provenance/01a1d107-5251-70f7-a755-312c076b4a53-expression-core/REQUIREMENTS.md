---
user: Charles Lien
task: Implement Linear issue ALL-2172 (expression core for variables, visibility, required-if and suite splits) from the variable framework spec, following the spec's REQUIREMENTS.md and the DECISIONS.md and EVIDENCE.md entries it names.
---

# Requirements

The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Its REQUIREMENTS.md is the source of truth; the entries below are the ones this change implements, restated so this file stands alone. Origin labels follow the spec's: **user**, or **approved (X)** for a proposal from X the user approved.

## Delivery

- ALL-2172 is change 1 of the spec: the typed tree, the interpreter, three-valued unknowns, error and pending outside the language, strict field reads, named expressions with cycle detection and dependent-break checks, the template fallback rule, the save check (`tsc` against declarations generated from the input list, plus the pass over the stored tree that finds results that could be undecided, following named expressions and covering ternary tests, list predicates and template values as well as top-level conditions), and the `isUnknown(…)` test. (user)
- ALL-2172 ships as stacked PRs, each started once the one below it merges, and each says `Part of ALL-2172`. This PR is the first: the typed tree, the parser from TypeScript syntax, the canonical printer, and the interpreter with three-valued unknowns, error and pending outside the language, strict field reads, and `isUnknown(…)` at runtime. The later PRs carry, in order: dependency reads and ordering of named expressions with cycle detection, and source maps from the tree to its text; the save check and the analysis that requires a fallback wherever a result could be undecided, including the template fallback rule; and named-expression saves checked against their dependents. Requirements below marked "Later PR" are those PRs' scope, not this one's. (user)
- Fourteen other issues build on ALL-2172, so the API it exposes in `common/` matters more than speed. (user)
- Each commit is reviewable on its own. (user)
- Storing and editing named expressions (table, versions, admin editor) belongs to ALL-2195 "Store and edit named expressions", not ALL-2172. (user)
- ALL-2172 ships without a re-check of stored expressions when the input list or functions change, since nothing stores expressions yet. Where that re-check runs and what it reads stored expressions from is decided in ALL-2195. For where it runs, this supersedes the spec's choice that CI re-runs the save check over stored expressions (`docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`). (user)

## Expression language (from the spec)

- One language for variables, visibility, required-if and suite split conditions: a restricted TypeScript expression subset with three-valued semantics. A condition is an expression whose result is yes/no; a variable is a named expression of any declared type; expressions can reference named expressions. (approved (agent research); TypeScript syntax with three-valued semantics: user)
- Later PR (save check): The save check combines `tsc`, against declarations generated from the shared input list, with an analysis of the stored tree that requires a fallback wherever a result could be undecided. The analysis, not `tsc`, decides where a fallback belongs, so TS2869 on a fallback the analysis requires doesn't fail the check. Any other type error blocks the save, shown at the offending expression. (user)
- What is stored is a typed JSON tree, not source text. One interpreter runs it on the server, web and mobile. Admins see text printed from the tree in a canonical layout. (approved (agent research, prototype))
- No sandboxing, metering or runtime limits beyond never using `eval`. (user)
- Reading a field that is not on an input's record is an evaluation error. Inputs always carry every declared field, `null` when missing. (approved (prototype))
- Later PR (named-expression saves): Saving a named expression that would break an expression depending on it is blocked, and the error lists each broken dependent with its reason; the admin may instead save it together with fixed dependents in one save. (approved (prototype); fixed dependents in one save: user)
- Later PR (save check): A text template part whose value could be missing is rejected unless the author supplies a fallback (`?? "…"`); the error says what members would otherwise see. (approved (prototype))

## Unknown values and errors (from the spec)

- Unknown is `null`. Comparisons with an unknown give undecided, and AND/OR/NOT follow SQL's three-valued rules: a known false still decides an All, a known true an Any. (approved (agent research))
- Negative comparisons never treat an unknown as a match; including unknowns takes an explicit `isUnknown(…)`. (approved (prototype))
- `isUnknown(x)` is always true or false, and at runtime a missing lookup or index gives `null`, never `undefined`. Later PR (save check): the generated declarations declare it `isUnknown(x: unknown): x is null | undefined`, and the analysis treats it as the same guard. `tsc` runs with `strict` and `noUncheckedIndexedAccess`. A generated built-in function parameter that accepts a missing value accepts both `null` and `undefined`. The save check rejects `=== null`, `!== null`, `== null`, `!= null`, `null` on either side of any other comparison, and an authored `undefined`, suggesting `isUnknown`. (user)
- Later PR (save check): Visibility and required-if handle undecided through a `??` the save check requires whenever the condition could be undecided; a suite split group handles it through its own fallback. (user)
- Error and pending are separate from unknown, sit outside the language, and are never treated as unknown. An error anywhere in a condition makes the whole condition an error, even where the other side would have decided it, except in a side of `?:` or `??` that isn't evaluated, as the next requirement says. (approved (agent research))
- Only the branch a ternary `c ? a : b` takes is evaluated, and the right side of `a ?? b` only when `a` is unknown, so an error in a side not taken doesn't make the result an error. `??` never recovers a failed or pending left side. AND/OR still evaluate both sides. In exchange the launch preview reports the errors any previewed member hit and the branches no previewed member took, separately from group counts; that report is ALL-2177's scope. For `?:` and `??`, this supersedes the requirement "An error anywhere in a condition makes the whole condition an error" in `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec/REQUIREMENTS.md`. (user)
- Inputs have stable ids, so renaming one is a label change. (spec agent decision on a choice the user deferred)

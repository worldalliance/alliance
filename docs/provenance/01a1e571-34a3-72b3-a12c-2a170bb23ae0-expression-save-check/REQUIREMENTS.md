---
user: Charles Lien
task: Implement Linear issue ALL-2172 (expression core for variables, visibility, required-if and suite splits) from the variable framework spec as stacked PRs; this is the third PR, the save check and the analysis that requires a fallback wherever a result could be undecided.
---

# Requirements

The earlier PRs of this plan are `docs/provenance/01a1d107-5251-70f7-a755-312c076b4a53-expression-core`, whose REQUIREMENTS.md restates the spec's requirements for all of ALL-2172, and `docs/provenance/01a1e0d4-77bc-7761-b4a8-94fd3f7d7ed0-expression-dependencies`. The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Origin labels follow the spec's: **user**, or **approved (X)** for a proposal from X the user approved.

## Delivery

- ALL-2172 ships as stacked PRs, each started once the one below it merges, and each says `Part of ALL-2172` except the last, which says `Fixes ALL-2172`. (user)
- This PR carries the save check: `tsc` against declarations generated from the input list, plus the pass over the stored tree that finds results that could be undecided, following named expressions and covering ternary tests, list predicates and template values as well as top-level conditions, including the template fallback rule. Named-expression saves checked against their dependents come in the next and last PR. (user)
- Fourteen other issues build on ALL-2172, so the API it exposes in `common/` matters more than speed. (user)
- Each commit is reviewable on its own. (user)
- Storing and editing named expressions (table, versions, admin editor) belongs to ALL-2195, not ALL-2172. (user)
- ALL-2172 ships without a re-check of stored expressions when the input list or functions change, since nothing stores expressions yet. Where that re-check runs and what it reads stored expressions from is decided in ALL-2195. (user)

## Save check (from the spec)

The entries the earlier PR's REQUIREMENTS.md marks "Later PR (save check)":

- The save check combines `tsc`, against declarations generated from the shared input list, with an analysis of the stored tree that requires a fallback wherever a result could be undecided. The analysis, not `tsc`, decides where a fallback belongs, so TS2869 on a fallback the analysis requires doesn't fail the check. Any other type error blocks the save, shown at the offending expression. (user)
- A text template part whose value could be missing is rejected unless the author supplies a fallback (`?? "…"`); the error says what members would otherwise see. (approved (prototype))
- The generated declarations declare `isUnknown(x: unknown): x is null | undefined`, and the analysis treats it as the same guard. `tsc` runs with `strict` and `noUncheckedIndexedAccess`. A generated built-in function parameter that accepts a missing value accepts both `null` and `undefined`. The save check rejects `=== null`, `!== null`, `== null`, `!= null`, `null` on either side of any other comparison, and an authored `undefined`, suggesting `isUnknown`. (user)
- Visibility and required-if handle undecided through a `??` the save check requires whenever the condition could be undecided; a suite split group handles it through its own fallback. (user)
- When a named expression the checked expression reads has a problem of its own, the check shows only that problem, at the named expression: a reader gets no problem that follows from it, such as a request for `?? false` or `?? true` or a type mismatch at the reference, so the admin sees one error at its cause and never has to undo an edit once it is fixed. (user)
- An expression the save check accepts doesn't fail at runtime because a guard beside `&&` or `||` was trusted for a value reaching an argument or operand that rejects a missing value: the interpreter evaluates both sides of `&&` and `||`, while `tsc` and the analysis narrow as though they stopped early, so the check reports such a value, saying that a ternary, which runs only the branch it takes, guards it. (user)

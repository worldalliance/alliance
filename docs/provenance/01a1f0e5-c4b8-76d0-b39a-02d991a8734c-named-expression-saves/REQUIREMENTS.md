---
user: Charles Lien
task: Finish Linear issue ALL-2172 (expression core for variables, visibility, required-if and suite splits) in this branch and open its PR; this is the fourth and last of its stacked PRs, named-expression saves checked against their dependents.
---

# Requirements

The earlier PRs of this plan are `docs/provenance/01a1d107-5251-70f7-a755-312c076b4a53-expression-core`, whose REQUIREMENTS.md restates the spec's requirements for all of ALL-2172, `docs/provenance/01a1e0d4-77bc-7761-b4a8-94fd3f7d7ed0-expression-dependencies` and `docs/provenance/01a1e571-34a3-72b3-a12c-2a170bb23ae0-expression-save-check`. The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Origin labels follow the spec's: **user**, or **approved (X)** for a proposal from X the user approved.

## Delivery

- This PR carries the last part of ALL-2172, named-expression saves checked against their dependents, and says `Fixes ALL-2172`. (user)
- Fourteen other issues build on ALL-2172, so the API it exposes in `common/` matters more than speed. (user)
- Each commit is reviewable on its own. (user)
- Storing and editing named expressions (table, versions, admin editor) belongs to ALL-2195, not ALL-2172, and so does the re-check of stored expressions when the input list or functions change. (user)

## Named-expression saves (from the spec)

- Saving a named expression that would break an expression depending on it is blocked, and the error lists each broken dependent with its reason. (approved (prototype))
- The admin may instead save the expression together with fixed dependents in one save. (user)
- Its dependents include, directly or through other named expressions, the split of every draft or scheduled suite that uses it and every form's rules. The save is blocked when it would leave such a split with a group that could be undecided and has no fallback, or would break a form's rules. The error names each broken dependent and the reason. Splits of live and finished suites are not checked, since they keep their pinned versions. (user) Splits and forms don't store expressions yet; they are wired in by ALL-2177 and ALL-2184, and same-suite reads, cross-suite cycles and the group-fix capture are checked by those changes.
- A fallback a save makes needless doesn't block it. Stored named expressions and stored dependents the save checks get every check except "This fallback can't change the result", so every real break still blocks; what the admin saves or fixes in the save, fixed dependents included, gets every check. The next person to edit such a stored expression is then asked to remove its fallback. (user)
- When a named expression a checked expression reads has a problem of its own, the check shows only that problem, at the named expression, so the admin sees one error at its cause. (user)

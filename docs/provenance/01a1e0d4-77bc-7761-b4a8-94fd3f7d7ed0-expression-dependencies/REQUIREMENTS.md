---
user: Charles Lien
task: Implement Linear issue ALL-2172 (expression core for variables, visibility, required-if and suite splits) from the variable framework spec as stacked PRs; this is the second PR, dependency reads and ordering of named expressions.
---

# Requirements

The earlier PR of this plan is `docs/provenance/01a1d107-5251-70f7-a755-312c076b4a53-expression-core`, whose REQUIREMENTS.md restates the spec's requirements for all of ALL-2172. The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Origin labels follow the spec's: **user**, or **approved (X)** for a proposal from X the user approved.

## Delivery

- ALL-2172 ships as stacked PRs, each started once the one below it merges, and each says `Part of ALL-2172` except the last, which says `Fixes ALL-2172`. (user)
- This PR carries dependency reads and ordering of named expressions with cycle detection. The save check and named-expression saves come in later PRs. (user)
- Fourteen other issues build on ALL-2172, so the API it exposes in `common/` matters more than speed. (user)
- Each commit is reviewable on its own. (user)
- Storing and editing named expressions (table, versions, admin editor) belongs to ALL-2195, not ALL-2172. (user)

## Expression language (from the spec)

- Expressions can reference named expressions. (approved (agent research))
- Named expressions get cycle detection. (user)

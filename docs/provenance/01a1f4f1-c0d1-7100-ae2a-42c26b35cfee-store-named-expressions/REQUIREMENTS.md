---
user: Charles Lien
task: Build Linear issue ALL-2195 (store and edit named expressions) in the variable-framework branch and open its PR.
---

# Requirements

The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. The save check this builds on is `docs/provenance/01a1f0e5-c4b8-76d0-b39a-02d991a8734c-named-expression-saves` (`checkNamedSave` in `common/src/expression/named.ts`).

## Delivery

- ALL-2195 is built in the `variable-framework` branch and delivered as one PR. (user-originated)

## Names

- Admins see named expressions as "Formulas": one name for yes/no conditions and computed values alike, in the sidebar, page headings and messages. (agent-proposed, user-approved)
- The old form builder's "Variables" tab, which holds the same idea for forms on the old system, is relabelled "Formulas"; only the label changes. (agent-proposed, user-approved)
- The facts an expression reads have no umbrella word for admins: pickers and autocomplete group them by kind ("Answers", "Settings", "Lists", "Tables"). (agent-proposed, user-approved)
- The test for a missing value is written `isMissing(x)`, not `isUnknown(x)`, renamed before any expression is stored. Its meaning is unchanged: always true or false, never undecided, true when a question was left blank or a fact has no value. This supersedes the spelling in the "Is unknown" requirement of `01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`, and the same spelling in `01a1d107-5251-70f7-a755-312c076b4a53-expression-core` and `01a1e571-34a3-72b3-a12c-2a170bb23ae0-expression-save-check`, which restate it. (agent-proposed, user-approved)

## Storage and saves (from ALL-2195)

- Named expressions are stored on the server with immutable versions, so a live split can pin a version and a fill-session load can record the versions it used. (ALL-2195-proposed, user-approved)
- Saving and deleting a named expression go through `checkNamedSave`, blocking a save or delete that breaks a dependent and listing each broken dependent with its reason. Dependents are wired in as splits and forms start storing expressions. (ALL-2195-proposed, user-approved)
- The admin may save a named expression together with fixed dependents in one save. (user-originated; restated from 01a1f0e5-c4b8-76d0-b39a-02d991a8734c-named-expression-saves)
- Each expression has an optional Notes field for explanations. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- What is stored is the typed tree, not the source text; the text shown to admins is printed from the tree. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- A type error from the server check blocks the save, with the error shown at the offending expression. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)

## Admin editor

- An admin editor for named expressions ships now, visible in the admin panel, with an empty input list; inputs appear as the issues that add them land (ALL-2173 onward). (agent-proposed, user-approved)

## Re-check of stored expressions

- When the input list, the functions or the save check change, the save check re-runs over every stored expression before each deploy, against production: `scripts/deploy_backend.sh` runs it on the new release before swapping it in, and a failure keeps the old release running. (agent-proposed, user-approved)

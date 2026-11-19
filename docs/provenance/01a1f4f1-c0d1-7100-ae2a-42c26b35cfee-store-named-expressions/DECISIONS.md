# Decisions

Agent decisions unless labelled otherwise. The research and agent reports behind the questions asked are in `EVIDENCE.md`.

## Names

- **Code names.** The server, the database and the admin use "formula": `Formula` and `FormulaVersion` entities, `formula` and `formula_version` tables, `/formulas` endpoints. The expression core in `common/src/expression/` keeps "named expression" (`NamedExpression`, `checkNamedSave`) for now. `common/src/forms/variables.ts` already exports an old-system `Formula` type, and admin has an old-system `FormulaEditor`, so renaming the core would give one package two unrelated `Formula`s. Rename the core when the old form system is removed (ALL-2185); ALL-2384 tracks the rename.
- **Messages without "input".** Messages the core shows admins say "formula" where they said "named expression". Following the requirement that admins see no umbrella word for what a formula reads, they name the thing (``Nothing here is called `x`.``, `` `x` is already used by something formulas can read. ``) or say "something". A removed input stays unnamed ("This uses something that no longer exists."), since a formula may have taken its id as its name, and naming it would point at the formula.
- **Old builder relabel scope.** Every admin-visible string in the old form builder that names a form variable says "formula": the tab, its heading, its buttons, and the save gate and validation messages, plus the server's delete-refusal message. A new variable's default name (`variable1`) is data, not a label, so it stays.

## Storage

- **Versions.** A `formula` row holds the id, current name and soft-delete time; each save adds an immutable `formula_version` row with the name it was saved under, the tree, notes and who saved it. The current version is the latest by id. Consumers pin a version id (spec, "Fill session" and go-live pinning), so no snapshot object is needed. The research found immutable rows per version to be the shared pattern where consumers pin versions (`EVIDENCE.md`, "Storing versions").
- **Ids.** The client picks a formula's UUID, so one save can create formulas that read each other, and problems refer to entries by the same id the client sent. Ids are lower-cased on arrival, since Postgres compares and returns UUIDs in lower case; a new formula is inserted, never upserted, so it can't take an existing formula's id.
- **Delete.** Soft delete: the formula leaves the list and its name is free again, while its versions stay for whatever pinned them. A delete goes through the same check and is refused, naming each reader, when something still reads the formula, following LaunchDarkly, Unleash and Postgres `RESTRICT` (`EVIDENCE.md`, "Blocking deletes").
- **Unchanged saves add no version.** A save whose name, notes and tree match the current version writes nothing for it, so the history lists only real changes.
- **Renames.** Renaming changes the formula row and adds a version; readers store ids, so they reprint under the new name. Two formulas can swap names in one save: renamed rows pass through a `__renaming:<id>` placeholder, which no real name can take.
- **Notes** are per version, so the history shows what a note said at each save.

## Saves

- **One endpoint.** `POST /formulas/save` takes edits and deletions together, since fixing a dependent in the same save is a requirement and a delete can need the same. A refused save is a normal outcome the editor branches on, so it answers 200 with `problems`, empty on success, rather than an error status.
- **Two admins at once.** Each edit and deletion names the version it started from. A save based on an older version, a new formula whose id exists, or a formula deleted meanwhile is refused with 409 and a message saying to reload. This is optimistic concurrency as RFC 9110 `If-Match` and Google AIP-154 describe, carried in the body because a save spans several formulas (`EVIDENCE.md`, "Two admins at once").
- **Saves take turns.** The check reads every formula, so a save holds a transaction-scoped advisory lock (`formulas`) from its read to its commit; otherwise two saves could each pass against what the other is about to change. The e2e test holds the lock itself and shows a save waits; concurrent requests alone didn't overlap in tests, because the synchronous check runs each save to completion first.
- **Dependents.** No consumer stores expressions yet, so saves pass no dependents. Splits (ALL-2177) and forms (ALL-2184) add theirs to the save and to the re-check.
- **Catalog.** `server/src/formulas/formula-catalog.ts` is empty, per the requirement to ship with an empty input list; the changes that add inputs fill it.
- **Cost.** With an empty catalog, the formulas e2e tests run in about 2.6 s in total. Revisit with real inputs; `named-expression-saves` DECISIONS.md names checking several expressions in one program as the next step.

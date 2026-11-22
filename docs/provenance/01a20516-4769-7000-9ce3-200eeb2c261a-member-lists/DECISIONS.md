# Decisions

Agent decisions unless labelled otherwise. The research behind them is in `EVIDENCE.md`.

## In the language

- **A tree node of its own.** A list read is stored as `{ kind: "onList", listId }` and printed as `isOnList("<current name>")`, as a formula reference is stored by id and printed by name, so a rename never touches a stored tree and `reads()` finds every list an expression reads, through formulas too. A call with the id as a string literal would have hidden the reference inside a literal that printing, dependency tracking and the delete block would each have to special-case.
- **Lists sit in the catalog.** `Catalog.lists` holds the lists that exist when a check or evaluation runs, since every check, the `tsc` declarations and the evaluator already take the catalog. The server builds it per request (`formulaCatalog` in `server/src/formulas/formula-catalog.ts`), so every save, listing and the pre-deploy re-check see the same lists.
- **Errors.** A name that matches no list fails with the names that exist (`There's no list called "X". Lists: "A", "B".`), following the spec's deferred choice that an error for a wrong choice value lists the allowed ones; anything but one quoted name fails with `Name one list in quotes, like isOnList("List name").`. `tsc` also sees `isOnList(list: "A" | "B"): boolean`, so autocomplete (ALL-2382) can offer the names.
- **Never undecided.** Membership is always known, so `isOnList(…)` is a plain yes/no value: it needs no fallback, and a `?? false` after it is the needless fallback the check already rejects.
- **Name reserved.** `isOnList` joins `isMissing` as a name of the language, so no formula, input or function can take it.
- **A tree reading a list that no longer exists** fails as a whole with "This uses a list that no longer exists.", as a removed formula or input does, and prints the list's old name where it is known and no current list has taken it, otherwise its id in quotes, which names no list.

## Storage

- **Versions.** `member_list` holds the id, name and soft-delete time; each membership save adds an immutable `member_list_version` with who saved it, and `member_list_member` rows hold its members. The latest version is current. A rename changes only the list row, since text reads the current name and nothing pins a name. A save whose members match the current version adds none.
- **Versions kept.** Every version is kept: nothing pins one yet. Fill sessions (ALL-2181) and splits (ALL-2177) bind `isOnList` to the versions they pin, and any pruning of unused versions belongs with them.
- **Deleted accounts.** A member's rows in every version are removed when their account is deleted, as their other join rows are: `softDeleteCascade` deletes `ON DELETE CASCADE` rows of a table without a delete date. A pinned version then lacks that member, who is never evaluated again. Proposed to the user as a plan they didn't object to.
- **Names** are unique among lists that aren't deleted (a partial unique index), trimmed, 1–100 characters, since formulas name a list by it.
- **Names bind when saved.** A formula save resolves each list name in its text against the lists stored then, as it resolves formula names, so an edit opened before a rename that frees a name, and a new list taking it, reads the new list without a 409. Guarding this means checking every name the editor saw, for formulas and lists alike: ALL-2392.
- **Concurrency.** A save names the membership version it edited and the name it saw, and gets a 409 when either changed since, so a stale save never reverts a rename; saves of one list, and its deletion, lock the list row in turn.

## Deleting

- **Through the formula save.** A list is deleted by `POST /formulas/save` with `deletedLists`, in the same transaction and advisory lock as formula edits, so the requirement that the admin may delete it together with fixed formulas is one save, and the refusal uses the formula save's problems. `checkNamedSave` takes `deletedLists`, re-checks each formula reading one, directly or through others, and blocks with each broken formula named.
- **Formulas count as dependents.** The spec names forms' rules and splits as the dependents that block a list delete; neither stores expressions yet, so formulas are the only readers, and the spec's "through named expressions" puts them on the path. A formula reading a deleted list would also fail the pre-deploy re-check and hold every deploy. Proposed to the user as a plan they didn't object to; it follows LaunchDarkly, Unleash and GrowthBook (`EVIDENCE.md`). Splits (ALL-2177) and forms (ALL-2184) add their dependents to the same check.

## Admin

- **Pages.** "Member lists" sits beside "Formulas" in the sidebar: an index with member counts, and a page per list with its name, members and delete. Proposed to the user as a plan they didn't object to.
- **Editing members.** The existing member picker (`UserSelect`), plus a box taking pasted member ids or emails, matched case-insensitively against the admin member list; entries matching no member are listed and left in the box to correct, never dropped. Save adds what the box still holds and stops while an entry matches no member, so pasted entries never go unsaved. No CSV upload: paste covers a CSV column at today's sizes (largest hand-picked list: 72). Proposed to the user as a plan they didn't object to (`EVIDENCE.md`).
- **Fixing on delete.** A refused delete lists the formulas reading the list, each with "Fix it in this save", reusing the formula editor's fix section, extracted into `FormulaFixes`.

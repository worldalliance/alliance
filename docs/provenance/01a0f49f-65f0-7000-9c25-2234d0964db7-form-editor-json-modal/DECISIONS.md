# Decisions

## Scope

- Element buttons go in the shared wrappers (`FieldWrapper`, `DisplayBlockWrapper`, `EditableFieldGroup`), so every page item and every group child gets one. Blocks nested in accordion/nested blocks are edited through their parent's JSON, because they aren't page items and have no ids other elements refer to.
- `FormBuilder` wraps each page item and group child in an `ElementJsonContext` holding its opener, and a wrapper shows the button whenever one is present. The field editors pass props to the wrappers one by one, so a context avoids touching every editor. `EditableNestedBlock` (accordion blocks) and `EditableListField`'s sub-field editors provide `null`, so nested elements don't reuse their parent's opener. Matching on the element object instead broke for editors that hand their wrapper a derived copy, such as a contract field with a contract selected.
- Output views, variables, aggregate views, `submit`, and share templates have no button of their own. The whole-form JSON covers them, and they're edited on other tabs with different shapes.
- The whole-form JSON is the `FormSchema` held in editor state (what the save request sends and `formsnapshot.schema` stores). Form-row metadata stays out.
- Display-only mode validates pasted JSON against the display-only schema as well, so a paste can't bring in something that mode rejects at save. It runs `formSchemaToDisplayOnly`, the conversion the display-only save uses, on the whole resulting schema, whatever the modal's level.
- Display-only mode has no page buttons, because it hides the page tabs; its single page is covered by the whole-form JSON. Form JSON there must keep exactly one page: the display-only editor shows only one, and Save flattens every page into one block list.

## UI

- A lucide `FileJson` icon button with a tooltip and `aria-label`, placed in the element toolbar next to the ⋯ menu, on each page tab next to the copy icon, and in the builder header. It opens a `sharedweb/ui/Modal`.
- The header button shows on every editor tab, not only Form Builder, since the whole-form JSON also covers what the other tabs edit.
- The modal ignores backdrop clicks, so a stray click doesn't discard edited JSON. Escape and the close button still dismiss it, even while Apply is looking up validators; closing drops that Apply. The textarea is read-only during the lookup, so the JSON that applies is the JSON that was checked.
- The editing area is a plain monospace textarea, not CodeMirror or similar. The main flow is copy out and paste back; a new dependency isn't worth it yet. (The user approved this and asked for it to live here.)
- `JSON.stringify(value, null, 2)`, in stored key order, so the text round-trips unchanged. Apply stores the admin's own parsed value when it equals zod's output, since zod rebuilds objects in schema key order; otherwise an unchanged Apply would reorder keys and mark the form unsaved.
- The buttons are hidden in preview mode, matching the other editing controls.

## Apply

- Apply parses the JSON, then runs the zod schema for its level: `pageSchema`'s item union for a top-level element, `fieldGroupSchema`'s child union inside a group, `pageSchema` for a page, `formSchema` for the whole form. Any failure blocks Apply and shows the parse or zod error in the modal (`describeSchemaIssues` from `common/src/zod-issues`).
- `describeSchemaIssues` now reports a failed union through its closest branch instead of a bare "Invalid input", since page items are a plain union and every element error would otherwise read that way. Among the branches that fit the input's shape (its root type, the branch's own tag literals, and its own discriminator), the one with the fewest issues is reported. With no fitting branch, the bare message stays, since naming any one shape would mislead; a typo'd `kind` reads as `fields.0: Invalid input`. This also sharpens the server's display-only, cohort-expression, and validator-results error text, which use the same function; the server's form-save validation calls `issuePath` directly and is unchanged.
- A whole-form paste with no pages is rejected. The editor can't remove the last page, and its page lookups assume one exists.
- The editor has no UI that can produce zod-invalid JSON, so rejecting it at Apply has no equivalent in the existing UI. It follows the repo's fail-loudly rule.
- Cross-element problems (broken visibility references, unresolved `#{variables}`, invalid variable inputs) aren't checked at Apply. Save reports them exactly as it does for manual edits, because a paste can briefly break a reference the admin is about to fix elsewhere.
- Apply goes through the editor's normal `updateSchema` path. The form becomes dirty; the unsaved-changes guard, Save, and conflict handling all work unchanged.
- Id collisions are rejected at Apply: a new or changed id that matches any other element or page id in the form. Duplicate ids would break the editor's id-based lookups before Save ever runs.
  - The ids counted are every id the editor keeps unique when it generates one: pages, page items, group children, list sub-fields, accordion sections and their blocks, output views and their blocks, and aggregate views. That walk is now `formSchemaIds` in `apps/admin/src/lib/formJson.ts`, and `FormBuilder`'s id generation uses it too. Output-view blocks count because `findDisplayBlock` looks blocks up by id across pages and output views.
  - Only a collision the Apply adds is rejected, so a duplicate already stored in the form doesn't block unrelated edits.
- Custom validators appear by id only, since their settings live in a separate table. At Apply:
  - a negative id must be among the current in-editor drafts, or Apply is rejected;
  - each positive id not already present in the form is fetched with `tasksFindOneCustomValidatorAdmin`, and a missing one blocks Apply. The endpoint answers a missing id with a 500 (`findOneOrFail`), so any error response blocks with "could not be loaded", which doesn't claim the id is missing; a request that gets no response at all blocks with "Could not check".

  This covers both `customValidatorId` on fields and `validatorId` in visibility conditions.

- After a whole-form Apply, if `selectedPageIndex` is past the end, it clamps to the last page, matching `removePage`.
- Every Apply remounts the page's editors and `VariableBuilder`, the same remount a conflict load already triggered (`conflictLoads`, renamed `schemaLoads`). Several editors keep local state that only follows their own edits.

## Id and kind change warning

A new warning. Before applying, the modal lists the changes below and requires a confirm click. With none, Apply runs straight away.

- Element modal: the element's `id` or `kind` changed, or the `kind` of any element nested in it (group children, list sub-fields, accordion blocks) whose id is still present, since the element's JSON includes them.
- Page modal: the page's `id` changed, or the `kind` of any element whose id is still present on the page changed, nested elements included.
- Whole-form modal: the `kind` of any element whose id is still present in the form changed: page elements (nested ones included), output-view blocks, and aggregate views.
- Every modal: below its own level (for the whole form: pages, page elements, output views and their blocks, aggregate views), the JSON both removed some ids and added others. That is listed as a likely rename.

Matching is by id, so renaming an element nested in the JSON being edited reads as one id going and another arriving. Reviewers repeatedly flagged that a silent rename orphans answers stored under the old id; asked whether to warn on it, the user replied "do whatever you prescribe. the original requirement wasn't super strong". So an Apply that both removes and adds ids below the scope's own level warns, naming both sets. An Apply that only removes, or only adds, applies without a warning, matching manual removal, which has no confirmation today.

## Out of scope

- Adding an element from JSON.
- Showing a diff before Apply.
- Editing validator settings through JSON.
- Server, frontend, and mobile changes, apart from the shared `describeSchemaIssues` wording above.

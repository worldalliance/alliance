---
user: Charles Lien
task: Surface copyable, editable JSON for each element, each page, and the whole form in the admin form editor
---

## Guiding principle (user)

- The form editor's whole job is to edit the form's JSON. Editing the JSON directly is another way to do the same thing, and the same UI should show for the same errors.
- New features beyond the existing UI are still welcome where they help.

## Stated by the user

- The admin form editor surfaces copyable, editable JSON for each element, each page, and the entire form, so the admin can copy it, edit it programmatically or with AI, and paste it back without going through the db viewer.
- It may sit behind a button that opens a modal. The user chose the modal.
- Edit in place only. Adding a new element from pasted JSON is out of scope.
- Pasting JSON is a local-only change. Nothing saves until the admin clicks "Save"; no auto-save.
- The form-level JSON is the schema only.
- The feature also applies in display-only mode (the builder used on general and action update pages).
- No diff view before applying (agent offered the existing `SchemaDiffView`; user declined for now).
- Changing an element's `kind` via JSON is allowed.
- When the JSON changes an id or a kind, the admin gets a warning and must click to confirm before it applies. The user asked for a new warning type for this (the editor currently has no UI that changes ids or kinds, so nothing existing to reuse).
- Removing elements via JSON shows the same warnings as removing them manually with the buttons (today: none).
- Anything allowed in the admin UI should also be allowed via JSON.
- No backend, frontend, or mobile functionality changes are required. Refactors and dedups there are welcome.

## Agent proposals the user approved

The approach below was written by the agent; the user replied "yes" or "go with your recommendation".

- (Approved, #1) Every page item gets a JSON button: question fields, display blocks, groups, and each child inside a group. A group's JSON includes its children. Blocks nested in accordion/nested blocks get no button of their own.
- (Approved, #2) Output views, variables, aggregate views, and shareable text templates are edited only through the whole-form JSON.
- (Approved, #6) Entry points are icon buttons on each element's toolbar, each page tab, and the builder header, opening a modal with Copy, an editable area, Apply, and Cancel.
- (Approved, #7) A plain monospace textarea rather than a code editor dependency. The user asked that this be recorded as a decision, not a requirement; see DECISIONS.md.
- (Approved, #8) Pretty-printed with a 2-space indent, keys in their stored order.
- (Approved, #9) Buttons are hidden in preview mode.
- (Approved, #10) The JSON shows current editor state, including unsaved edits.
- (Approved, #12) Apply is blocked by invalid JSON or a zod schema failure at the element, page, or form level, with errors shown in the modal. Cross-element checks (`validateFormSchema`, unresolved variables) stay at Save as today.
- (Approved, #14) Ids may change, but Apply is rejected if the new id collides with another element or page.
- (Approved, #16) A negative (unsaved-draft) `customValidatorId` not among the current drafts is rejected at Apply.
- (Approved, #17) After a whole-form paste that shrinks the page count, the selected page falls back to the last existing page.
- (Approved, #19, after the agent explained that the stored `formsnapshot.schema` equals the editor's schema except for draft validator ids) Validators appear in the JSON by id only; their settings stay edited through the field's menu.
- (Approved, #20 and #24) Apply checks that each positive validator id exists and blocks if not.
- (Approved, #25) How id and kind changes are detected per level; see DECISIONS.md.
- (Approved, #18) Admin app only, behind existing admin gating; no migration.

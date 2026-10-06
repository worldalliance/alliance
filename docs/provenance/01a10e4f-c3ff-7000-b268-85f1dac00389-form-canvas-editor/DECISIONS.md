# Form canvas editor

This is the implementation specification. The approved proposals and their origin are recorded in REQUIREMENTS.md. The implementation details below are agent choices, with rationale.

The work ships as a sequence of PRs. Each one leaves the builder working, passes the affected packages' checks on its own, and is reviewable without the later ones. Later PRs build on earlier ones in the order listed.

## Scope and existing contracts

- Implement the editing experience in the admin app, extracting shared web rendering support where needed. Use the current form and display-only schemas, endpoints, validation semantics, and snapshot conflict handling. The approved behavior requires no server changes, database migration, or new schema fields.
- Apply the canvas to every consumer of the shared form builder: standalone forms, action forms, follow-up forms, and action/general update content. Honor each owner's existing save path and allowed element types. Update content stays display-only.
- Keep the layouts of Shareable Text, Output View, Aggregate Views, and Variables. Their draft changes participate in the shared history. Common condition controls may be reused there where compatible, but expanding their layout redesign is a separate task.
- Preserve supported field/block settings, copy operations, page operations, JSON editing at its existing scopes, custom validators, personalized content, and preview-as-user. The redesign changes their presentation, rather than the underlying form behavior.
- Preserve respondent rendering and submission on web and mobile. Admin selection and editing controls belong to the admin authoring surface.

## Evidence informing the condition editor

Read-only staging inspection covered 121 current saved forms, excluding historical snapshots. Rules repeated identically within one form were counted once. Form pages contained 209 distinct visibility formulas across 65 forms: 145 single conditions, 26 AND-only combinations, 5 OR-only combinations, and 33 formulas containing NOT. Of the latter, 30 negate individual conditions and 3 negate a group. Output-view formulas were counted separately and excluded from those 209.

The page conditions contained 175 equality checks, 33 option-membership checks, 26 presence checks, 19 validators, 13 any-selection checks, 12 selection-count checks, and smaller numbers of device/account checks. Fifty-nine answer-based conditions referenced another form. These are observations of saved configuration, rather than usage-frequency measurements or user requirements.

Use answer comparisons, selection membership, and answered/unanswered checks as the most prominent choices. Keep cross-form sources and negation easy to reach. Offer the other supported condition kinds through the same insertion menu; retain advanced expressions for shapes that cannot be represented losslessly by the simple controls.

## Findings from a first, single-PR attempt

An end-to-end prototype was built and then reverted because it was too large to review as one change. Findings that shape the plan:

- `ConditionalVisibility` is about 1,600 lines inside `CommonControls.tsx`, and it renumbers conditions on every edit. It is used by field cards, block cards, page visibility, visibility group cards, and output-view blocks, so rewriting it in place upgrades all of them at once.
- `parseVisibilityFormula` only tokenizes `conditionN` names, while saved formulas (and existing tests) use other names such as `c1`. The expression editor must accept any condition name.
- Existing field/block editors render their own preview, drag handle, remove button, condition controls, and "…" menus. Nine block editors embed a `RenderDisplayBlock` preview. Reusing them in a sidebar needs a presentation context that drops the card chrome and previews; `DisplayBlockWrapper` must keep its card mode for Output View.
- Lifting the per-user override target out of `DisplayBlockWrapper` caused an infinite update loop when the context value was recreated each render and the setter stored a new object unconditionally. The setter must bail out on an unchanged value, and effects must depend on stable values.
- Canvas summaries need option labels and other forms' question labels, not stored values and field ids; `summarizeVisibility` needs label resolvers for both.
- Happy-dom's default 1024px viewport decides which responsive layout tests exercise.

## PR 1: Condition editor

Rewrite `ConditionalVisibility` in its own folder (`form-fields/conditions/`), replacing it at every current call site. The surrounding builder layout is unchanged.

- Use the existing named conditions and formula tree as the saved representation. All/Any creates AND/OR nodes; negative checks create NOT nodes or use an existing condition's negative value where equivalent.
- Recognize a formula as simple only when conversion is lossless: a single condition, or a homogeneous All/Any combination with supported per-condition negation, where every defined condition is referenced exactly once. Keep grouped negation, mixed combinations, unreferenced conditions, and other complex shapes in the expression editor.
- Changing a condition's source, comparison, or value preserves the surrounding expression. Maintain stable condition names: a new row takes the number after every name used by the conditions or the formula, so deleting a row never retargets a reference.
- In simple mode, adding/removing rows follows the selected All/Any combination. With no rows, visibility is unconditional.
- In advanced mode, retain the expression text exactly while editing rows. Adding a row makes it available for explicit reference. Removing a referenced row leaves the expression and a visible missing-reference error until repaired. Converting to simple mode requires the admin to explicitly choose the replacement combination.
- Expression text that doesn't parse stays in the editor with its error. In this PR the editor holds it locally; PR 2 moves it into the draft.
- A rule identifies its source form, question label, compatible comparison, and value. Keep a visible distinction between sources on this form and another form; preserve the existing eligibility rules for same-page/later-page references.
- Show literal values using their type: option labels for selections, booleans for checkbox/contract checks, and number inputs for numeric values. Keep option-value renaming propagation and current formula-backed option handling.
- One "Add rule" menu lists answer-on-this-form and answer-on-another-form first, then validator, device, account checks (input views), or output-block visibility (output views).
- Reuse validators and existing device/account condition controls. A loading or failed source lookup retains the authored rule and provides retry/error feedback. A reference whose validity cannot be established stays visibly unresolved rather than showing another question.
- Generalize `parseVisibilityFormula` to accept any identifier as a condition name, folding case only for generated `conditionN` names.

Checks: unit tests for simple-shape detection and building, name allocation, and the tokenizer; component tests replacing `ConditionalVisibility.formula.test.tsx` for single, AND, OR, per-rule NOT, and group-negated formulas, simple round-trips, advanced edits, and removing a referenced row.

## PR 2: Draft history

Replace `useVisibilityGroupedSchema` with a draft-history hook in the existing builder, and add undo/redo controls.

- The draft holds the schema, editor-only group membership, custom-validator drafts, and unparsed expression buffers, so history covers the entire form draft across builder tabs. Selection, scroll position, preview answers, lookup results, and open/collapsed navigation state are presentation state.
- Commits made in one task are one step. A text-editing run is one coalesced step: commits typed into the same text control while it keeps focus fold together, and re-focusing starts a new run. Native text-input undo owns typing while that editor has focus; application undo covers completed draft operations.
- Provide visible undo/redo controls with accessible labels and standard keyboard shortcuts. A new edit after undo clears the redo branch. Empty history disables the corresponding control. Editors that keep their own copy of a formula remount on undo/redo, as they already do after a load.
- Undoing deletion restores the original IDs and rules. Undoing an edit to user-specific content restores that exact user's override.
- Explicit Save/Cmd-S persists through the existing owner-specific path. Save success updates the saved baseline while retaining history; undoing to a different schema marks the draft dirty. Save failure retains the draft, validation buffers, and history.
- Custom-validator creation replaces temporary IDs during Save. Rewrite every history entry to the persisted IDs and drop the resolved drafts, so undo/redo never reintroduces an unresolved temporary validator or performs a duplicate server write. Stop garbage-collecting unreferenced drafts in an effect; only referenced drafts are created at Save.
- Opening another form resets history. Accepting a remote version or merged replacement after a conflict resets history to the accepted draft. Keeping the existing local draft retains its history. Apply JSON is an ordinary undoable draft operation (form-scope JSON regroups), rather than a remote replacement.
- History lasts for the mounted editing session and is not stored in the database or restored after a reload. Keep the current unsaved-navigation warning and snapshot conflict workflow.
- Move PR 1's unparsed expression text into the draft, keyed by target and formula role, so it survives navigation and undo.

Checks: unit tests for the history reducer (coalescing, undo/redo, redo branch, mapping all entries); builder tests for undo across tabs, JSON Apply, validator draft-ID resolution, conflict replacement, and dirty state after undo.

## PR 3: Canvas workspace

Replace the card list, element palette, and page tab strip with the three-part workspace. Shared visibility keeps its current operations, moved into the sidebar.

- Keep the builder tab navigation, undo/redo, and Save/Preview controls above a three-part workspace: outline, form canvas, and settings sidebar. Each area scrolls independently so selecting or editing does not displace the admin's location.
- Show one selected page using respondent typography, spacing, and field/block presentation (`RenderField`/`RenderDisplayBlock`). Editing overlays add selection outlines, insertion points, drag handles, and concise condition indicators. Avoid repeating a miniature preview inside the settings panel.
- Address selection by stable identity: page id, element id (position only for display blocks the schema lets go without an id), so reordering cannot redirect an edit. Start with the first page and page settings selected. Fall back to the page when the selected element no longer exists, such as after undo.
- Show Content, Conditions, and Advanced sections as in the sidebar comparison. Select Content for an individual element and Conditions for a visibility group. Clicking a condition indicator selects its Conditions section directly.
- Clicking a form input selects its containing field. Authoring suppresses answering, submitting, upload/signing actions, and outbound links. Media and accordion controls needed to inspect layout remain usable without invoking respondent actions.
- Render existing editors in the sidebar through a section context: `FieldWrapper` renders the editor's controls under Content and validator/output/extraction settings under Advanced; `DisplayBlockWrapper` gains the same sections while keeping its card mode for Output View; inline block previews hide in the sidebar. Advanced also holds the element ID, JSON at element/page scope, duplicate, and delete.
- An empty page offers an insertion point and a brief empty state. The picker searches permitted question/content types and preserves existing copy-from-element behavior (not inside a group). Insertion selects the result and focuses its first applicable editing control.
- Organize the outline by pages and top-level elements, with visibility groups shown with their members. Page controls provide add, copy, delete, and reorder. Selecting an outline entry opens its page, expands the enclosing group, scrolls it into view, and updates the sidebar.
- Support drag handles on the canvas and outline, with explicit move controls for keyboard use. Moves stay within a page, as today.
- Groups appear as a subtle boundary with their summary and element count; their sidebar offers the shared rule, split, ungroup, detach, and the existing join/merge actions until PR 5 replaces them.
- Keep the persistent sidebar at 1024px and wider. At narrower widths, use an accessible settings drawer that closes to reveal the form; the outline can collapse behind its own control. Preserve selection when changing layout. Move focus into an opened drawer, support Escape to close it, and restore focus to its invoking element. Avoid changing focus when merely scrolling the canvas or switching a desktop selection through a pointer.
- Provide keyboard selection, labeled icon controls, visible focus, and explicit wording for deletion. Hover can reveal shortcuts but cannot be the only way to reach essential controls.
- Display-only update editors retain their permitted settings and element types; they offer no Conditions section, viewer-specific conditions, or user overrides.
- Preview keeps using the existing Preview and preview-as-user flow. Returning to editing restores the selected page/element.

Checks: builder tests rewritten for the canvas (select/edit without answering, insert/copy/move elements and pages with stable IDs, JSON scopes, display-only editors); browser pass on a multi-page staging-like form and a display-only update at wide and narrow widths.

## PR 4: Nested elements, inline text, and personalized content

- Outline entries for list sub-fields and accordion sections/blocks. A list displays one representative row of selectable child fields; child edits change the list schema, rather than a sample answer. Accordion section titles and child blocks are selectable; expanding a section exposes its contents, and selecting inside one expands it. Existing allowed sub-field kinds and nesting limits remain the boundary.
- The list and accordion editors show their children as selectable rows with move and delete, instead of inline editors.
- Render text formatting while preserving authored variable tokens. A pencil control or Enter on a selected editable text target (question labels, header/text/quote/label blocks, accordion section titles, page title) opens its source editor in place; reuse variable suggestions. Changes update the draft during editing as one coalesced step; blur or Escape exits.
- Default authoring uses default block content. Selecting a user override in the selected block's sidebar changes the canvas to that override and visibly names the user. The builder holds the override target per block; its setter bails out on an unchanged value. The existing default/override selection and import affordances remain available.
- Inline and sidebar edits address the selected default or user override explicitly. Async editing actions capture their target so switching selection cannot write an upload or other delayed result into a different block/user.

Checks: tests editing a list child and an accordion block through both outline and canvas; inline editing of a label containing a variable token; editing a user override, switching targets, and undoing without changing another user's content.

## PR 5: Shared visibility by selection

- Groups remain editor metadata over consecutive top-level page elements. Save the shared formula on each member using the existing schema. Derive groups from consecutive equal formulas on load; identify each group by its summary and element count.
- Support a consecutive selection range within one page through Shift-selection on the canvas and outline and an accessible checkbox per outline entry. With two or more selected, the sidebar offers sharing visibility. Extending selection across pages or nested scopes is unavailable.
- When members have differing formulas, show their current rules and require an explicit choice of an existing formula or a newly authored replacement. Applying that choice sets the same formula on every member and forms one group as one undoable operation.
- Group members show the shared summary and a link to group settings. Changing shared visibility updates every member together. A member must detach before editing a separate rule.
- Detach, split, and ungroup retain each affected element's current formula. They change editor membership, rather than making elements unconditional, and stay in undo history even when the saved schema is identical.
- Splitting or moving members preserves the consecutive-group invariant. A group that falls below two members dissolves into individual elements carrying their rules.
- Remove the join-neighbor and merge-groups actions this replaces.

Checks: select a consecutive range, resolve differing rules explicitly, apply a shared rule, and detach/split/ungroup without erasing visibility; undo each operation restores formula and membership.

## PR 6: Dependencies and deletion

- Compute source/dependent links from the current draft (pages, top-level elements, and list sub-fields, visibility and required-if), updating after edits, moves, deletion, JSON application, and undo/redo. Search the current form; do not fetch all forms to build a global dependency graph.
- The Conditions section shows "Depends on" source questions and a question's "Used by" targets, including dependent pages and list children. Group repeated shared targets together, with access to the members. A page dependent is a selectable page entry.
- Same-form links select and reveal their target. A cross-form source link opens the existing form editor in a new tab with the source selected, conveyed by a `select` query parameter read once on load.
- Before deleting a referenced question or a container/page containing one, list the affected elements and name the deletion action ("Delete question", "Delete page"). Proceeding retains their authored references. Deleting an unreferenced element uses the ordinary deletion affordance and remains undoable.
- Unresolved references show the available source identifier; navigation remains useful for locating the dependent even when its source is gone.

Checks: navigate from a dependent to its source and from a question to its dependent page/element; open an external source in another tab while retaining the current draft; delete a source after viewing affected targets, then undo.

## PR 7: Authoring errors and gating

- Apply the existing schema validation plus authoring checks: unparsed expression buffers, expressions naming undefined conditions, and same-form rules reading questions the form lacks. These checks stay in the admin; server validation is unchanged.
- Show errors beside affected canvas/outline entries and at the top of the sidebar. A header issue list links each error to its target. Keep malformed content editable through a flagged element shell (an error boundary per canvas element that retries when the content changes).
- Block Save and entering Preview while errors remain, saying how many and opening the issue list. Pending source checks show their pending state; failures expose retry and preserve local edits.
- Resolve errors as edits repair them. Undo can restore an invalid draft, which restores its error and gate too. Preserve existing unmatched-variable warnings separately from blocking schema/reference errors.
- A last-valid schema tree cannot conceal an invalid editing buffer from Save or Preview.

Checks: unit tests for the authoring checks; builder tests for Save/Preview blocking, the issue list's navigation, the flagged shell, and empty, source-loading, source-error, and form-load-error states, each leaving the draft recoverable and exposing the next action.

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
- In advanced mode, retain the expression text exactly while editing rows. Adding a row makes it available for explicit reference. A row the expression references can't be removed until the expression stops using it, so the expression is preserved and the admin repairs it. Converting to simple mode requires the admin to explicitly choose the replacement combination.
- Expression text that doesn't parse, or that names a rule no condition defines, stays in the editor with its error and isn't saved. Nothing gates Save on a broken formula until PR 10, and the runtime reads a missing name as false, so saving one would silently change who sees the element. In this PR the editor holds the text locally; PR 2 moves it into the draft.
- A rule identifies its source form, question label, compatible comparison, and value. Keep a visible distinction between sources on this form and another form; preserve the existing eligibility rules for same-page/later-page references.
- Show literal values using their type: option labels for selections, booleans for checkbox/contract checks, and number inputs for numeric values. Keep option-value renaming propagation and current formula-backed option handling.
- One "Add rule" menu lists answer-on-this-form and answer-on-another-form first, then validator, device, account checks (input views), or output-block visibility (output views).
- Reuse validators and existing device/account condition controls. A loading or failed source lookup retains the authored rule and provides retry/error feedback. A reference whose validity cannot be established stays visibly unresolved rather than showing another question.
- Generalize `parseVisibilityFormula` to accept any identifier as a condition name, folding case only for generated `conditionN` names.

Checks: unit tests for simple-shape detection and building, name allocation, and the tokenizer; component tests replacing `ConditionalVisibility.formula.test.tsx` for single, AND, OR, per-rule NOT, and group-negated formulas, simple round-trips, advanced edits, and removing a referenced row.

As implemented:

- Each rule's comparison menu depends on the question type: choice, number, and contract questions offer is / is not / is answered / is unanswered; multiselects offer includes / does not include / has any selection / is unanswered / number selected; text and custom components offer answered / unanswered; a checkbox offers "is" with Checked/Unchecked. "Is not" and "does not include" are a NOT around the condition. A NOT over a condition with its own negative field (answered, output-block visibility, user city/property) displays as that negative value, and an edit to that rule rewrites it without the NOT. NOT over any other kind (any selected, selection count, validator, device, contract date, action count) keeps the formula in the expression editor. A validator with no result yet fails both "passes" and "fails", so NOT passes differs from fails.
- A rule's source is fixed when it is added ("Answer on this form" or "Answer on another form"), as in the previous editor; a cross-form rule changes forms through its own form picker. Rules list in formula order in simple mode and in natural name order in the expression editor, which shows each rule's name.
- Expression text saves on every keystroke that parses and names only defined rules. Cleared text asks for an expression rather than leaving the saved formula in place unseen. A name typed before its rule exists binds to the rule once one is added under that name, since unsaved text never reached the formula that new names avoid. Leaving the expression editor needs no replacement choice when the saved formula is already a lossless rule list and the text matches it; otherwise the admin picks All rules or Any rule.
- `serializeVisibilityFormula` drops parentheses around a same-operator AND/OR right child, so a rule list (built right-nested, as the parser builds it) reads `a AND b AND c`, and a left-nested saved chain keeps its parentheses so it reparses unchanged. Parentheses around NOT stay, because visibility summaries substitute prose for names.
- Retry covers the form list and a source form's questions (`refetch` from `useFormQuestionFields` and `useFormOptions`). Saved visibility validators load through react-query (`useSavedValidator`) so a failure shows an error with Retry. The previous effect logged the failure and showed "Loading" indefinitely.

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

As implemented:

- A pure reducer (`draftHistory.ts`) holds past, present, and future drafts; `useDraftHistory` tags each commit with its task and text run, and `useFormDraft` replaces `useVisibilityGroupedSchema` with the form-specific operations. A task is every commit made before the next microtask, so an `await` splits one handler's writes into two steps. A commit whose draft equals the present, by value, adds no step and keeps redo, since editors write unchanged values (a number input on blur). A text run is the commits made in input or change events while one text input, textarea, or contenteditable keeps focus; any focus change starts a new one. A write landing outside such an event (an upload finishing while the admin types elsewhere) stays out of the run, so one undo doesn't take both. Undo and redo end the current step, so typing after an undo starts a new one.
- Expression buffers are keyed by where their editor sits: `element:<page id>/<element id>`, that key plus `/<sub-field id>` for a list sub-field, `page:<page id>`, `group:<group key>`, or `output:<view id>/<block key>`, provided through an `ExpressionScope` context. An element without an id (legacy display blocks may lack one) has no key that stays its own, so its text stays in component state (`LocalExpressionBuffers`) as before: out of the draft, adding no undo steps, and lost on remount. A position key would hand the text to whatever element moves into that slot, and a mount key would fill history with steps no editor can show. Each scope holds one condition editor, and a group's key survives its members changing. A form-level Apply JSON regroups with new keys, so a group's text doesn't survive it even where the formula holds; undo brings it back, and keeping it would mean matching new groups to old ones by members. Only visibility formulas have an expression editor, so the key carries no formula role. A buffer records the formula the schema holds beside its text: what the text saved, or the formula it left in place while it doesn't parse. The editor's own writes (typing, adding a rule) update both together. The editor shows the text only while the schema still holds that formula, so a formula replaced from outside it (Apply JSON, a group's Clear visibility) shows instead of stale text; the text stays in the draft and returns with the formula, as on undo. This replaces PR 1's editor, which kept unsaved text through any formula change. Text typed before any rule exists has no formula to follow, so the visibility toggle around its editor opens on it rather than hiding it, and turning the toggle off drops it in the same step.
- Editors that write a value they derive rather than one the admin chose (a contract question's default contract and its cached contract text, a custom component's default component and config defaults) write through `useDerivedWrite`, which amends the current step. As separate steps, undoing past them re-derived them into a new step that cleared redo, so a new contract question could never be undone.
- Save's list-input naming amends the current step, and Save then ends the step, so typing after a save starts a new one and undo stops at what was saved. Validator creation rewrites each history entry whose draft matches the one created; an entry holding an edited version of that draft keeps its temporary id, so restoring it creates the validator it describes. The rewrite happens once creation succeeds, before the form save, so a failed form save retries without creating the validators again.
- Keep mine amends the present with the saved version. Take theirs and Merge start a new history with no validator drafts or expression buffers: Save created the validators before the conflict surfaced, so both sides already hold real ids, and typed text belongs to formulas the replacement may not have.
- Undo and redo are icon buttons (Undo2/Redo2 with labels and shortcut tooltips) beside the JSON button, hidden in Preview and disabled while saving, loading, or resolving a conflict, since Save amends the present it started from and the other two are about to replace it. ⌘/Ctrl+Z undoes and ⇧⌘/Ctrl+Z or Ctrl+Y redoes (not ⌘Y, which macOS browsers use for History), within the builder (or with nothing focused), except inside a text control or a dialog; the builder can sit in a page with other controls, such as an action's follow-up forms tab. Undo and redo keep the page on screen by id (`useSelectedPage`), since they can add, remove, or reorder pages before it, and stay at its position when that page goes, or the last page if that position is gone. They close the insert picker and search, whose position on the page may no longer hold. The page visibility editor and the Output View's block editors remount on undo/redo along with the element editors; the Output View keeps its selected view. Remounting also drops local text an editor hasn't committed to the draft (a custom component's config JSON that doesn't parse yet); keeping it would mean moving each such buffer into the draft, as the next change does for expressions.

## PR 3: Canvas and settings sidebar

Replace the card list and element palette with the form canvas and a settings sidebar. The page tab strip stays until PR 4 replaces it with the outline. Shared visibility keeps its current operations, moved into the sidebar. The original PR 3 also held the outline; it moved to PR 4 to keep each change reviewable.

- Keep the builder tab navigation, undo/redo, and Save/Preview controls above the workspace: form canvas and settings sidebar, with the outline joining as a third part in PR 4. Each area scrolls independently so selecting or editing does not displace the admin's location.
- Show one selected page using respondent typography, spacing, and field/block presentation (`RenderField`/`RenderDisplayBlock`). Editing overlays add selection outlines, insertion points, drag handles, and concise condition indicators. Avoid repeating a miniature preview inside the settings panel.
- Address selection by stable identity: page id, element id (position only for display blocks the schema lets go without an id), so reordering cannot redirect an edit. Start with the first page and page settings selected. Fall back to the page when the selected element no longer exists, such as after undo.
- Show Content, Conditions, and Advanced sections as in the sidebar comparison. Select Content for an individual element and Conditions for a visibility group. Clicking a condition indicator selects its Conditions section directly.
- Clicking a form input selects its containing field. Authoring suppresses answering, submitting, upload/signing actions, and outbound links. Media and accordion controls needed to inspect layout remain usable without invoking respondent actions.
- Render existing editors in the sidebar through a section context: `FieldWrapper` renders the editor's controls under Content and validator/output/extraction settings under Advanced; `DisplayBlockWrapper` gains the same sections while keeping its card mode for Output View; inline block previews hide in the sidebar. Advanced also holds the element ID, JSON at element/page scope, duplicate, and delete.
- An empty page offers an insertion point and a brief empty state. The picker searches permitted question/content types and preserves existing copy-from-element behavior (not inside a group). Insertion selects the result and focuses its first applicable editing control.
- Support drag handles on the canvas, with explicit move controls for keyboard use. Moves stay within a page, as today.
- Groups appear as a subtle boundary with their summary and element count; their sidebar offers the shared rule, split, ungroup, detach, and the existing join/merge actions until PR 8 replaces them.
- Keep the persistent sidebar at 1024px and wider. At narrower widths, use an accessible settings drawer that closes to reveal the form. Preserve selection when changing layout. Move focus into an opened drawer, support Escape to close it, and restore focus to its invoking element. Avoid changing focus when merely scrolling the canvas or switching a desktop selection through a pointer.
- Provide keyboard selection, labeled icon controls, visible focus, and explicit wording for deletion. Hover can reveal shortcuts but cannot be the only way to reach essential controls.
- Display-only update editors retain their permitted settings and element types; they offer no Conditions section, viewer-specific conditions, or user overrides.
- Preview keeps using the existing Preview and preview-as-user flow. Returning to editing restores the selected page/element.

Checks: builder tests rewritten for the canvas (select/edit without answering, insert/copy/move elements with stable IDs, JSON scopes, display-only editors); browser pass on a multi-page staging-like form and a display-only update at wide and narrow widths.

As implemented:

- `SidebarSections` provides the active section to the selected element's editor; `FieldWrapper` and `DisplayBlockWrapper` render `SectionPanels` instead of a card when it is present. A panel mounts when first opened and then stays mounted while hidden: an unvisited section fetches nothing (custom validators, the user list), and local text survives switching sections. Panels provide null to their content, so list sub-fields and accordion blocks stay cards, as do Output View blocks.
- Conditions shows the visibility editor directly, without the card's "Use conditional visibility" toggle. "Remove all conditions" takes the toggle's place, dropping the formula and any typed expression in one step; without it, an advanced formula whose rules the expression references could never be made unconditional. Text typed before any rule therefore stays visible until removed. Output View and nested cards keep their toggles.
- Selection is the page id plus an element id (or the position of an id-less block, which any move updates; undo, redo, Apply JSON, and conflict loads, which can shift it, return the selection to the page) or a group key; merging a selected group into the previous one follows the surviving key. Choosing a page tab selects its page settings. Undo and redo keep the selection by id; deleting the selected element shows page settings on Content, away from where Delete page sits in Advanced, and undoing the deletion returns to the element.
- The canvas renders `RenderField` inert with a no-op `onChange`, and `RenderDisplayBlock`; images, video, and accordions stay interactive, with link clicks suppressed. Authored text shows uninterpolated.
- The insert picker lists every permitted type before anything is typed; Enter takes the first match, and Escape returns focus to its button. The end-of-page "Add element" button is always shown; points between elements appear on hover or focus. Inserting selects the new element and focuses the first control of its Content.
- Advanced holds the element ID, Edit element JSON, Duplicate (inserted after the original, in its group), and Delete question or Delete block; Move up and Move down sit beside the sidebar heading, stay focusable (`aria-disabled`) at the page's edge, and step past the whole of a group the element isn't in, so they never split one; dropping an element between a group's members on the canvas still does, as dragging did before. A page's Advanced holds its ID, Edit page JSON, Copy page, and Delete page.
- A group's boundary header selects the group on its Conditions: the summary, merge, ungroup, clear, errors, and the shared editor. Its Content lists the members, each selectable and detachable, with a split control between them. Groups no longer collapse. A group whose members fail validation says how many on its boundary, since its errors are listed only in its settings.
- Below 1024px, settings open in a drawer when something is selected or from "Open settings". The drawer is an `aside` rather than a dialog, so ⌘/Ctrl+Z still undoes inside it; Escape or its close button returns focus to whatever held it when it opened, or to the selection on the canvas once that is gone (an insert picker, after inserting). When the sidebar changes what it shows and so removes the control that had focus (Delete, a group member, Ungroup), focus moves to the sidebar rather than dropping to the page, so Escape still closes the drawer.
- A display-only editor shows Content and Advanced; its page has no settings, so selecting it shows a hint.
- Removed as orphaned: the element palette (`ElementSelect`), `PageSegmentList`, `PageVisibilityControl`, `ElementJsonContext`, and the cards' group and element JSON controls, since no card renders a top-level element any more.

## PR 4: Outline

Replace the page tab strip with an outline to the left of the canvas.

- Organize the outline by pages and top-level elements, with visibility groups shown with their members. Page controls provide add, copy, delete, and reorder. Selecting an outline entry opens its page, expands the enclosing group, scrolls it into view, and updates the sidebar.
- Support drag handles in the outline for pages and elements, with explicit move controls for keyboard use. Element moves stay within a page.
- At widths below 1024px, the outline collapses behind its own control.

Checks: select elements and pages from the outline across pages; add, copy, delete, and reorder pages with stable IDs; move elements by drag and by keyboard; outline collapse at narrow widths.

As implemented:

- `FormOutline` lists each page with a disclosure control, its top-level elements, and each visibility group as an entry ("Shared visibility · N elements") holding its members. The open page starts expanded and the others collapsed, so a long form stays compact; groups start expanded. A selection made anywhere (canvas, sidebar, undo) expands the page and group holding it and scrolls its entry into view in the outline. Groups never collapse on the canvas, so "expands the enclosing group" applies to the outline.
- Choosing an outline entry opens its page, selects it (Content for a page or element, Conditions for a group, as on the canvas), and scrolls the canvas to it. Selecting on the canvas doesn't scroll it, so clicking a tall element can't move the admin's place.
- Add page sits in the outline's heading; it appends a page, opens it, and focuses its title. Copy page and Delete page stay in the page's Advanced section, where PR 3 put them, since a destructive icon in a compact outline row would have to say what it does in words. Move page up/down sit beside the page settings heading, as Move up/down do for an element, and are the keyboard path for reordering pages; element keyboard moves stay in the element's sidebar. The tab strip's per-page JSON button is gone; page JSON stays in Advanced.
- Rows drag by their whole row, with a grip on hover. Pages reorder among pages and elements within their own page, including a page that isn't open; a drop onto another page's elements does nothing. The canvas and outline share `useListDrag` and `DropLine`. Group entries don't drag, as groups don't on the canvas.
- Below 1024px the outline opens from an "Open outline" button at the canvas's top left, as a left drawer with the settings drawer's focus and Escape handling (the two share one `Drawer`). Choosing an entry closes the outline and opens settings, as any selection does at that width.
- A display-only editor's outline lists its blocks without page entries or Add page, since its page has no settings.
- The canvas is a "Form canvas" region, so tests and assistive technology can tell its "Select …" buttons from outline entries with similar names.

## PR 5: Nested elements

The original PR 5 also held inline text editing and personalized content. Each touches different editors, so they moved to PRs 6 and 7 to keep each change reviewable; PR 7's override targeting covers PR 6's inline edits too.

- Outline entries for list sub-fields and accordion sections/blocks. A list displays one representative row of selectable child fields; child edits change the list schema, rather than a sample answer. Accordion section titles and child blocks are selectable; expanding a section exposes its contents, and selecting inside one expands it. Existing allowed sub-field kinds and nesting limits remain the boundary.
- The list and accordion editors show their children as selectable rows with move controls, instead of inline editors.

Checks: tests editing a list child and an accordion block through both outline and canvas.

As implemented:

- An element selection can carry a child: a list sub-field, an accordion section, or a block in a section, each addressed by id, or by position where the schema lets it go without one (sections may lack ids). A child that is gone resolves to its nearest enclosing item still there (a section's block to the section, then to the element), and undo, redo, Apply JSON, and conflict loads drop a child addressed by position, as they do an id-less element.
- The list and accordion editors list their children as rows to select, with Move up/down, and no longer embed the children's editors. Adding a sub-field, block, or section selects it with its first control focused. Delete sits in the child's own Advanced section, as for elements, rather than in the rows, since the rows are compact and a destructive action says what it does in words.
- A selected child's settings show its editor, Move up/down beside the heading (keeping it selected), a link back to its container, and its id and Delete in Advanced. A sub-field gets Content, Conditions, and Advanced; a section (its title) and a section's block get Content and Advanced, since neither carries visibility. Deleting a child shows its container's Content.
- Removed as orphaned: the field editors' card layout (preview, "…" menu, and conditional-visibility toggle) and `FieldExtraMenu`, since every field editor now renders in the sidebar. Their unit tests render the editor in `EditorSidebar`.

## PR 6: Inline text

- Render text formatting while preserving authored variable tokens. A pencil control or Enter on a selected editable text target (question labels, header/text/quote/label blocks, accordion section titles, page title) opens its source editor in place; reuse variable suggestions. Changes update the draft during editing as one coalesced step; blur or Escape exits.

Checks: inline editing of a label containing a variable token.

## PR 7: Personalized content

- Default authoring uses default block content. Selecting a user override in the selected block's sidebar changes the canvas to that override and visibly names the user. The builder holds the override target per block; its setter bails out on an unchanged value. The existing default/override selection and import affordances remain available.
- Inline and sidebar edits address the selected default or user override explicitly. Async editing actions capture their target so switching selection cannot write an upload or other delayed result into a different block/user.

Checks: editing a user override, switching targets, and undoing without changing another user's content.

## PR 8: Shared visibility by selection

- Groups remain editor metadata over consecutive top-level page elements. Save the shared formula on each member using the existing schema. Derive groups from consecutive equal formulas on load; identify each group by its summary and element count.
- Support a consecutive selection range within one page through Shift-selection on the canvas and outline and an accessible checkbox per outline entry. With two or more selected, the sidebar offers sharing visibility. Extending selection across pages or nested scopes is unavailable.
- When members have differing formulas, show their current rules and require an explicit choice of an existing formula or a newly authored replacement. Applying that choice sets the same formula on every member and forms one group as one undoable operation.
- Group members show the shared summary and a link to group settings. Changing shared visibility updates every member together. A member must detach before editing a separate rule.
- Detach, split, and ungroup retain each affected element's current formula. They change editor membership, rather than making elements unconditional, and stay in undo history even when the saved schema is identical.
- Splitting or moving members preserves the consecutive-group invariant. A group that falls below two members dissolves into individual elements carrying their rules.
- Remove the join-neighbor and merge-groups actions this replaces.

Checks: select a consecutive range, resolve differing rules explicitly, apply a shared rule, and detach/split/ungroup without erasing visibility; undo each operation restores formula and membership.

## PR 9: Dependencies and deletion

- Compute source/dependent links from the current draft (pages, top-level elements, and list sub-fields, visibility and required-if), updating after edits, moves, deletion, JSON application, and undo/redo. Search the current form; do not fetch all forms to build a global dependency graph.
- The Conditions section shows "Depends on" source questions and a question's "Used by" targets, including dependent pages and list children. Group repeated shared targets together, with access to the members. A page dependent is a selectable page entry.
- Same-form links select and reveal their target. A cross-form source link opens the existing form editor in a new tab with the source selected, conveyed by a `select` query parameter read once on load.
- Before deleting a referenced question or a container/page containing one, list the affected elements and name the deletion action ("Delete question", "Delete page"). Proceeding retains their authored references. Deleting an unreferenced element uses the ordinary deletion affordance and remains undoable.
- Unresolved references show the available source identifier; navigation remains useful for locating the dependent even when its source is gone.

Checks: navigate from a dependent to its source and from a question to its dependent page/element; open an external source in another tab while retaining the current draft; delete a source after viewing affected targets, then undo.

## PR 10: Authoring errors and gating

- Apply the existing schema validation plus authoring checks: unparsed expression buffers, expressions naming undefined conditions, and same-form rules reading questions the form lacks. These checks stay in the admin; server validation is unchanged.
- Show errors beside affected canvas/outline entries and at the top of the sidebar. A header issue list links each error to its target. Keep malformed content editable through a flagged element shell (an error boundary per canvas element that retries when the content changes).
- Block Save and entering Preview while errors remain, saying how many and opening the issue list. Pending source checks show their pending state; failures expose retry and preserve local edits.
- Resolve errors as edits repair them. Undo can restore an invalid draft, which restores its error and gate too. Preserve existing unmatched-variable warnings separately from blocking schema/reference errors.
- A last-valid schema tree cannot conceal an invalid editing buffer from Save or Preview.
- With Save gated, allow removing a rule the expression references, leaving the expression with its missing-reference error until repaired, as REQUIREMENTS.md describes. PR 1 blocks that removal only because nothing gates Save before this PR.

Checks: unit tests for the authoring checks; builder tests for Save/Preview blocking, the issue list's navigation, the flagged shell, and empty, source-loading, source-error, and form-load-error states, each leaving the draft recoverable and exposing the next action.

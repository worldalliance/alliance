# Admin visibility groups

This is the settled spec, not an implementation record. The choices below originated with the agent and were approved by the user unless labeled as derived acceptance criteria.

## Scope and representation

Remove the stored group variant and its group-specific behavior from schema definitions, validation, builder controls, and form consumers. Remove inherited group visibility and requiredness handling as part of that removal. Implement no content migration or legacy-group conversion.

The new UI operates on top-level questions and display blocks in input-form pages. A group is a consecutive run within one page. An accordion is one member; its children do not participate independently. Output views and other nested content are outside this version.

Every member retains its own `visibleIfFormula`. A shared edit writes the same value to all members in one local schema update. Group boundaries and collapse state belong to builder state, never form JSON, API payloads, snapshots, or database records. This preserves the existing per-element runtime behavior and storage contract.

## Initial grouping and lifetime

On loading a form, form maximal consecutive runs of at least two elements with matching, present visibility conditions. Compare the entire saved condition structure recursively, ignoring object-key order. Preserve array order, condition names, formula tree structure, and values when comparing. Logical equivalence alone does not qualify: reordered operands or renamed condition labels can remain separate.

An element without a condition breaks a run and remains independent. A single conditional element also uses ordinary individual editing, without a group wrapper.

Preserve manual boundaries through saves, page changes, preview, and other edits within the open builder. Matching neighbors do not merge automatically during editing, including after deleting an intervening element or editing conditions to match. This lets an admin split first and change conditions afterward.

Reopening the builder, importing a replacement form schema, or replacing the schema through conflict resolution reconstructs grouping from conditions. Consequently, unchanged split halves can reunite on reload. Splitting, ungrouping, and collapsing alone do not dirty the saved form; changes to conditions or element order follow normal unsaved-change handling.

## Editing and presentation

A group presents one shared visibility editor, a condition summary, and an element count above its members. Member cards retain their individual settings and offer “Edit visibility separately” in place of independent visibility editing while grouped. That action detaches the member with its condition intact.

Groups start expanded. Collapse hides the member-editing cards while leaving the visibility summary and count available; expand reveals them. Collapse state lasts only in the editing session and has no effect on respondent visibility or preview rendering.

Existing individual visibility controls remain the editing surface for singletons. Requiredness remains an individual setting.

## Membership operations

| Operation                                       | Result                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Split at a boundary                             | Create separate runs without changing any member's condition.                                                                    |
| Detach one element / edit separately            | Keep its condition and isolate it; a middle detach leaves separate runs on either side.                                          |
| Ungroup all                                     | Make all members independent while preserving their conditions.                                                                  |
| Join previous/next group                        | Replace the joining element's condition with the adjacent destination's condition and include it in that group.                  |
| Add a new element explicitly to a group         | Initialize the new element with that group's condition.                                                                          |
| Ordinary insertion, movement, or copy           | Preserve the inserted element's condition; split the surrounding group where needed to keep every group consecutive and uniform. |
| Merge adjacent groups                           | Combine their members; if conditions differ, choose one of the two existing conditions for every member.                         |
| Clear group visibility                          | Remove the condition from every member and dissolve the group into independent unconditional elements.                           |
| Edit a member's visibility through element JSON | Detach it if its condition changes, preserving other members' conditions and separating the remaining runs.                      |
| Edit unrelated element JSON settings            | Retain membership.                                                                                                               |

Any group reduced to one member loses its wrapper. Empty groups disappear. Membership operations preserve document order; ordinary reordering brings a distant element next to a target group before joining.

For a merge between different conditions, present “Use previous group's visibility” and “Use next group's visibility,” each with its condition summary. Selecting one is sufficient to apply it. Matching conditions need no condition choice. Boundaries remain explicit even if a merge produces a run that matches another neighbor.

## Invalid dependencies

Permit a local edit, join, or merge even when the resulting conditions are invalid. Show a specific error and prevent saving until corrected. For example, joining question A to a group whose condition reads A applies the condition locally but produces a self-dependency error.

Do not exclude a condition source merely because it is one of the group's members. Retain the editor's other source eligibility rules. Validate the resulting per-element conditions, including self-references and cycles; grouping does not grant a shared condition special runtime meaning.

Apply a shared condition change to every member together, including when it produces an error. Avoid partial application that would leave a group with differing conditions. An admin can fix the shared condition, clear it, or detach and correct the offending member before saving.

## Deliberate exclusions

Defer visibility copy/paste and undo. This feature does not introduce bulk requiredness, editable group names, whole-group movement, or whole-group deletion. These additions are unnecessary for shared visibility editing and would expand the interaction scope.

## Derived acceptance criteria

These scenarios express the approved behavior as implementation checks. All named elements and conditions are synthetic.

1. Load a page containing `A(X), B(X), C(no condition), D(X), E(X)` and a second page beginning with `F(X)`. Only A–B and D–E group; C and F stay independent. Reordering object keys within X preserves the match, while a structurally different equivalent formula does not.
2. Edit A–B's shared condition and verify both elements receive it. Save and reload with no group metadata in the payload; preview evaluates the resulting individual conditions.
3. Split a matching run, save, switch pages, and enter/leave preview. The split survives all three. Reopening or replacing the schema reconstructs the matching run. Splitting alone produces no unsaved-data prompt.
4. Detach a middle member from a five-member run. Its condition is unchanged, and the two remaining pairs stay separate. Ungrouping all preserves each formula; clearing shared visibility instead removes each formula.
5. Join an adjacent element whose condition differs and verify only the explicit destination condition is adopted. Ordinary movement or copying retains the moved/copied condition, while explicit creation inside a group inherits the shared condition.
6. Delete an intervening element or edit two neighboring runs to match. They remain separate until explicitly merged. Merging different conditions applies the chosen previous/next condition to all members without a second confirmation.
7. Create a self-reference or cycle through a group operation. The local edit remains visible, a specific error appears, and saving is blocked. Correcting the dependency restores save eligibility.
8. Change one member's visibility through element JSON and verify it detaches. Change unrelated JSON properties and verify membership persists.
9. Collapse a group and verify the builder retains its summary and count while hiding member cards. Expanding restores the cards; neither operation alters form JSON or respondent rendering.
10. Remove members until one remains and verify ordinary individual editing replaces the wrapper. Verify questions and display blocks can share a group, while accordion children and output-view blocks receive no new grouping controls.
11. Verify the removed schema group variant is rejected rather than converted and that ordinary flat forms retain their existing visibility and requiredness behavior across consumers.

## Implementation choices

These were made by the implementing agent; they refine the spec above where it left room.

- Membership is an element-id → group-key map (`apps/admin/src/lib/visibilityGroups.ts`) held in one state with the schema (`useVisibilityGroupedSchema`), so every schema edit renormalizes membership in the same update. Normalization keeps each group a consecutive, uniform run of at least two: a changed condition or an interposed non-member splits it, and the first surviving run keeps its key (and therefore its collapse state). This one rule covers the JSON-edit detach, ordinary insertion/movement/copy, deletion of an intervening element, and singleton unwrapping. Matching is `json-stable-stringify` equality, already used by the admin schema diff.
- An element moved into the middle of a group it doesn't belong to splits that group even when its condition matches, because membership, not condition equality, defines a group during editing.
- Only form-scope JSON import, loading the form, and conflict "take theirs"/merge regroup from conditions. Element- and page-scope JSON edits renormalize instead, so unrelated edits keep membership.
- Join is offered on any ungrouped element with an id whose immediate neighbor has a condition: joining a grouped neighbor enters its group; joining an ungrouped conditional neighbor forms a new group of two. Without the second case an admin could not form a group from scratch during a session. Grouped members join another group by detaching first.
- Merge is offered from a group's header toward an adjacent group. The choice panel lists both conditions; picking one merges immediately. Matching conditions merge on click.
- Insert points inside a group create the new element with the group's condition; the search there omits "Copy Existing Element", because a copy keeps its own condition and would only split the group it was placed in.
- Display blocks without an id, and every element in the display-only (update) builder, never group, since membership is keyed by id and display-only blocks have no conditional visibility.
- Grouped members' cards learn their role through `VisibilityGroupContext`, scoped to the top-level element id so list sub-fields and accordion children nested inside a member don't pick it up. The member card hides its own visibility editor and toggle and shows "Edit visibility separately".
- The shared editor's sources are the fields before the group plus the rest of the page from the first member on, members included. Group cards show validation errors for their members live; saving stays blocked by the existing save-time `validateFormSchema` check, which now reports a self-reference specifically.
- Reading old snapshots (`common/src/forms/stored-schema.ts`) treats a stored group like any other element it can no longer parse and skips it, the module's existing contract for unreadable elements; the requirements state no stored groups exist.

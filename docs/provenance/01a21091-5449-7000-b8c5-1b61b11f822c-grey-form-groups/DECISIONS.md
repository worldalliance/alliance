# Decisions

## Schema

- **Marker is a group id, not a boolean.** Every top-level page element, question fields (`baseFieldSchema` in `common/src/forms/field-schemas.ts`) and display blocks (`baseBlockFields` in `common/src/forms/display-blocks.ts`), gets an optional `group: string`. A run of consecutive elements with the same id is one box, so two groups can sit back to back as separate boxes. Agent decision; the user deferred the storage shape.
- **Only top-level elements carry it.** Accordion children omit it (`NESTED_OMITTED_FIELDS`), which keeps groups un-nested by construction. An accordion may itself be a group member. Agent decision.
- **List sub-fields reject it with a refinement, not an omit.** List sub-fields reuse the top-level field schemas, and zod 4 refuses `.omit()` on the select, multiselect and ranking schemas because they carry refinements (EVIDENCE.md, **Measurements**). So `group` sits on `baseFieldSchema` and the list's `fields` array refuses any sub-field that sets it; `ListSubField`'s type still allows it. Agent decision.
- **Run logic lives in `common/src/forms/form-groups.ts`.** `elementRuns` splits a page into runs that both renderers draw, and `splitGroupRuns` finds the runs validation rejects, so the rule has one implementation. Agent decision.
- **Same id on non-consecutive elements is invalid.** Schema validation (`form-schema-validate.ts`) rejects a page where one group id appears in two separate runs, and the builder keeps ids normalized, as `normalizeVisibilityGroups` does for visibility groups. A single-element group is valid. Agent decision.
- **No title field**, per the requirement; no `fieldset` or `role="group"` on the box, since an unnamed group adds screen-reader noise and the optional Header block supplies the heading. Agent decision from the research summarized in EVIDENCE.md.

## Compatibility and rollout

- Web and mobile clients don't strictly parse the form schema; they show the outdated-client notice only for an unknown element `kind` (`findUnknownFormElementKind` in `shared/formrenderer.ts`). An older app version therefore ignores `group` and renders the members without the box, which is an acceptable fallback. Reconstructed from existing code, checked 2026-11-24.
- The server validates saves against the strict `formSchema`, so it must accept `group` before the admin can write it. PR 1: schema, validation and both renderers. PR 2: builder UI, opened once PR 1 is live in production, per root `AGENTS.md` **Breaking changes**. Agent decision.

## Rendering (web `sharedweb/forms/FormElements.tsx`, mobile equivalent)

- Runs are computed over the page's full element list before visibility filtering. Hidden members are not drawn; a box whose members are all hidden is not drawn. A hidden member does not split its run. Agent decision.
- On mobile, a video block inside a group gets its top or bottom margin only from a visible member above or below it in the same group, since the box's padding already separates it from what is outside. Agent decision.
- The full-screen task flow lifts a page's first Header block out as the screen title (`buildFlowScreens`). When that header is a group member, the rest of the group still draws its box without it. Agent decision; the builder can warn about it in PR 2 if it confuses staff.
- The box matches Quote block on each platform: `bg-zinc-100`, `rounded-lg` on both (web Quote is square today; the group is rounded per the requirement), padding as Quote's (`px-5 py-4` web, `p-4` mobile), the page's normal element spacing between members. Padding was deferred to the agent.
- Mobile's dark mode uses whatever Quote uses at implementation time, so the two greys stay identical. Agent decision.
- Contrast inside the box meets WCAG 2.2 AA through task-form-wide colours, not overrides scoped to the box: control borders that are a control's only boundary move to a colour reaching 3:1 on white and on `#f4f4f5` (zinc-500), and small helper text to zinc-600, checking focus, error and selected states too. That is its own PR, which must land before PR 2 lets staff create groups; PR 1 leaves colours alone, since nothing writes `group` until PR 2. Uniform colours avoid a second look inside the box and an unproven scoping mechanism on mobile. The user deferred the approach; agent recommendation, from EVIDENCE.md **Inputs on a tinted surface**.
- A Quote block inside a group renders unchanged (grey on grey). Agent decision; revisit if it looks wrong in the prototype.
- Groups apply to task form pages only. Output views, the response CSV/HTML exports and `display-only-markdown.ts` ignore `group`. Agent decision.

## Builder (PR 2)

- Grouping is explicit, not an adjacency toggle: with a range of elements selected on the canvas (`rangeSelection.ts`), a "Group" action assigns a fresh id; a group's settings offer "Ungroup", and each member offers "Remove from group", which splits the group when the member is in the middle. Every action works from the keyboard. The canvas and outline draw the grey box around members. Agent decision, to prototype against the existing selection UI before committing.
- An element inserted between two members joins the group; one inserted at either edge doesn't. Moving a member out of its run, or to another page, drops its `group`. Copying a page (`copyWithUniqueIds.ts`) gives its groups fresh ids. Agent decision.
- Visual groups are independent of builder-only visibility groups (`apps/admin/src/lib/visibilityGroups.ts`); an element can be in both. Agent decision.

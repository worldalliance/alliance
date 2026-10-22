---
user: Alex Dorey
task: Build the Responses table view in the admin form-responses page
---

## Task

The user wrote a full specification in one message. Everything below is theirs.

The `responses` tab of `apps/admin/src/components/FormResponsesView.tsx` renders the
placeholder `"Nothing here yet."`. Replace that stub with a searchable, sortable,
column-configurable table of form responses, one row per response, plus a
snapshot/version navigator and a response detail drawer. Leave the `replays`,
`stats` and `questions` tabs alone.

## Where it goes

- The table lives in its own component tree, e.g. `apps/admin/src/components/responses-table/`,
  rather than growing the 1,279-line `FormResponsesView.tsx`. That file passes it the
  props it already holds: `form`, `responses`, `variantOptions`, `withdrawnUserMap`,
  `sidsToUserMap`, `loading`, `error`.
- It must work from all three call sites: `pages/FormResponses.tsx` (single form),
  `pages/ActionDashboard.tsx`, and `components/ActionMergedResponsesTab.tsx` (which
  passes `variantOptions` and groups responses from cloned per-variant forms).

## Data

- `FormResponseDto` (`server/src/tasks/form.dto.ts:210`) carries `id`, `answers`, `formId`,
  `formSnapshotId`, `schemaSnapshot`, `createdAt`, `sid`, `deviceType`, `sessionReplayUrl`,
  `phDistinctId`, `publicAnswers`, `visibilityValidatorResults`, `user?`,
  `aiDetectionResults?`.
- Every response pins its own `formSnapshotId` and carries that version's `schemaSnapshot`.
  Responses on one form routinely span several snapshots.
- Parse any stored schema with `storedQuestionFields()` from
  `@alliance/common/forms/stored-schema`, which returns `Result<AnyField[], ZodError>` and
  skips elements that no longer parse. Do not copy the existing
  `schemaSnapshot as unknown as FormSchema` cast from the Replays tab; the repo forbids `as`.
- Field kinds are `FieldKind` from `@alliance/common/forms/form-schema`; human labels come
  from `elementInternalDescriptor` in `@alliance/common/forms/element-descriptors`.
- Measured against the local db: worst form is 398 responses; worst schema is 67 top-level
  items; worst snapshot spread is 25 versions on one form. Everything stays client-side.
  No new endpoints, no server pagination, no virtualization.

## Columns

Metadata columns, left to right:

| Column          | Default                               | Notes                                                                                                                                                        |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Respondent name | shown, hideable                       | leftmost, sticky on horizontal scroll; reuse the existing `getRespondentName` logic (`user.name`, else `anonymous invited by <sid owner>`, else `anonymous`) |
| Submitted       | shown, hideable                       | abbreviated date + time                                                                                                                                      |
| Variant         | shown when `variantOptions` is passed | swatch + name                                                                                                                                                |
| Withdrawal      | shown, hideable                       | the existing `WithdrawalBadge` / `WithdrawalInfo`                                                                                                            |
| Response ID     | hidden                                |                                                                                                                                                              |
| User ID         | hidden                                |                                                                                                                                                              |

AI-detection score, PostHog replay link, SID and device get no columns; they live in the
drawer.

Question columns follow schema order. The header shows the field's label via
`elementInternalDescriptor`. A raw field id (`block-1789523333513`) is never header text:
a field with no label shows the swatch plus `Untitled <kind>`, with the id available on
hover.

## Snapshot handling

Two modes. Focused (default) shows the question fields of the form's current snapshot.
Expanded shows the union of question fields across every distinct snapshot present in the
loaded responses; current-snapshot fields keep schema order and come first, retired fields
follow, visually muted, with a tooltip naming the last version that had them.

The view auto-switches to Expanded when any loaded response holds a non-empty answer for a
field id absent from the current snapshot, i.e. when Focused would hide real data. Merely
spanning several snapshots is not enough; weekly forms routinely span 2 to 3 snapshots with
identical fields, and the mode must not flap. A manual toggle overrides the automatic
choice and persists.

The same field id across versions is one column, headed with the current wording; if the
wording changed between versions, mark the header and show each version's wording on hover.
Two different ids are two columns even when worded identically. Merging them is not safe.

## Cell rendering

A `Record<FieldKind, CellRenderer>`, so a newly added field kind fails the build.

- Every cell truncates to a single line by default.
- Clicking a cell expands that row; all its cells grow to full height. Click again to
  collapse.
- A global "Expand rows" toggle in the toolbar un-truncates every row at once, lists
  included.
- `list` (array of records): the first entry's summary followed by `(+N others)`; expanding
  grows the row to show all entries.
- `city`: the place name. `multiselect` / `ranking`: option labels, not raw values,
  comma-joined, ranking numbered in order. `checkbox`: a check/dash icon, not `true`/`false`.
  `file`: filename as a link. `contract`, `custom`: agent's judgment, but never raw JSON in
  a cell.
- Unanswered reads as a muted `—`, never `NULL`.

## Search

One global search box, case-insensitive substring match against the rendered display text
of every visible cell, so results always explain themselves. Hidden columns are not
searched. Debounce the input and highlight the matched substring in matching cells.

Independent of the existing `filterField` / `filterOp` / `filterValue` params the Stats tab
writes; those stay wired to the Replays tab only.

## Sorting

Click a header to sort. The cycle is ascending, descending, unsorted. Single column.
Comparators are type-aware per `FieldKind`: numbers and ranges numerically, dates
chronologically, option fields by label, text lexically.

## Column visibility

A dropdown listing every column with a checkbox, plus "show all" / "hide all" and a filter
box for finding a column by name among 67 of them. Each entry shows its swatch.

## The identity swatch

One shared utility: a small rounded square filled with a linear gradient between two pastel
colors derived deterministically from a string hash. `chroma-js` is already a dependency of
`apps/admin`. The same function serves question column headers (stable per field id, so a
reworded question keeps its visual identity across versions), snapshot version chips, and
variant chips (replacing the current blue pill). Same input always yields the same colors;
different inputs should be easy to tell apart. Unit-test determinism and reasonable spread.

## Snapshot navigator

A drawer opened from a "Versions" button in the toolbar. It is a fuller view than the
existing `/forms/:formId/snapshots` page, which shows no responses, and does not replace
it; link out to it for snapshot reassignment.

Contents, newest first: every snapshot with at least one response in the loaded set, plus
the current snapshot even if it has none. Per entry: swatch + short version identifier and
its `createdAt`; the date range of its responses and the response count; what changed
versus the previous version (fields added, removed, reworded, options changed).

Clicking a version filters the table to responses submitted against it, surfaced as a
clearable chip in the toolbar. Selecting two versions shows a side-by-side diff
(`react-diff-viewer-continued` is already a dependency) over normalized schemas.

## Response drawer

Clicking a row, outside an expand toggle, opens a right-side drawer. There is no drawer
component in `sharedweb/ui` yet; `Modal.tsx` is built on `@base-ui/react/dialog`, so build
the drawer the same way. Keep it in `apps/admin` unless a second caller appears.

The drawer holds the fully rendered response, reusing the `FormRenderer` invocation the
Replays tab already uses (`renderFormAsCompleted`, `disableOptionRandomization`, AI scores
via `fieldLabelRightContent`), plus a metadata block with response id, user id, SID, device
type, submitted date, snapshot version chip, withdrawal details, AI-detection scores and
the PostHog replay button.

Prev/next buttons move through the table's current filtered and sorted order. Escape
closes. The source row stays highlighted while it is open.

## Release date

The page header shows the form's release date beside the title: the `createdAt` of its
earliest response across all responses, unaffected by search or filters. Weekly forms are
one `Form` per week, so this is a single date per form. Do not group rows by snapshot;
snapshot windows overlap on long-lived forms and would produce nonsense sections.

## State persistence

- localStorage, keyed by form id: column visibility, expand-rows toggle, snapshot mode
  override.
- URL params, namespaced through the existing `paramKey()` helper so embedding pages do not
  collide: search query, sort column and direction, selected snapshot version, open
  response id.
- A "Copy view link" button in the toolbar serializes the hidden-column set into the URL as
  well. Opening a URL that carries hidden columns wins over localStorage and writes through
  to it.

## Out of scope

- The existing CSV export button stays exactly as it is. It is being phased out; do not
  extend it to the new table.
- No server changes, no new endpoints, no migrations.
- The `replays`, `stats` and `questions` tabs keep their current behavior.

## Repo constraints stated by the user

Read `AGENTS.md` and `apps/AGENTS.md` first; apply `skills/provenance/SKILL.md`,
`skills/unslop/SKILL.md` and `skills/trim-comments/SKILL.md`.

- Add `@tanstack/react-table` (headless, so it takes the existing Tailwind and `sharedweb`
  components) to both `apps/admin/package.json` and `apps/frontend/package.json` at the same
  version range, because the workspace installs every web package from `apps/frontend`. Run
  `bun install` after. Do not add a virtualizer; 398 rows do not need one.
- Closed sets branch via exhaustive `switch` with `satisfies never`, or a `Record<Enum, T>`
  lookup. Both forms apply even at two variants.
- No `as`. Validate untrusted shapes with zod at the boundary; `satisfies` and `as const`
  are fine.
- Fallible operations return `Result<T, E>` from `common/src/result.ts` via the `R.*`
  helpers.
- Fail loudly: a schema that will not parse says so on screen rather than rendering an
  empty table.
- Three or more function parameters become a single `params` object.
- Icons over text labels (`lucide-react`); every icon-only control carries a tooltip or
  `aria-label`.
- Comments default to none.
- Surgical changes: every changed line traces to this request, and adjacent code keeps its
  existing style.
- Anything not pinned down is the agent's judgment, recorded in `DECISIONS.md`.

## Success criteria stated by the user

1. `bun run typecheck` passes from `apps/admin`.
2. `bun run test apps/admin` passes, including new unit tests for: column derivation across
   a multi-snapshot response set, the Focused to Expanded auto-switch trigger (that it fires
   on an orphaned answer and that it does not fire on identical fields across snapshots),
   search matching against rendered text, sort comparators per field kind, and swatch
   determinism.
3. `bun run format:check` is clean.
4. Verified in the browser per `skills/playwright/SKILL.md` against local forms 138 (135
   responses, 3 snapshots), 140 (133 responses, 67 schema items, the column-count stress
   case) and 5 ("Reliability form", 378 responses across 25 snapshots, the Expanded-mode
   stress case): search narrows rows, headers sort, columns hide and persist across reload,
   a row opens the drawer and prev/next walks it, and the version navigator filters and
   diffs.

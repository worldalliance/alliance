# Decisions

Agent choices while building the Responses table. The spec fixed most of the shape; what
follows is what it left open, plus the two places I read it as covering more than the
`responses` tab.

## Module layout

`apps/admin/src/components/responses-table/` holds the feature. Pure logic sits in `.ts`
files so the tests run without a DOM: `columns.ts` (snapshot parsing, mode detection, column
derivation), `snapshots.ts` (version entries and their diffs), `sorting.ts` (comparators),
`search.ts`, `persistence.ts`. `cells.tsx` and `rows.tsx` are `.tsx` only because a few
cells render an icon or a chip.

Three pieces moved out of the feature directory because two callers now need them:

- `lib/identitySwatch.ts` + `components/IdentitySwatch.tsx`: the swatch, the chip.
- `components/WithdrawalInfo.tsx`: `WithdrawalBadge` and `WithdrawalInfo`, lifted out of
  `FormResponsesView.tsx` byte for byte. Importing them back from that file would have made
  a runtime import cycle.
- `lib/respondent.ts`: the respondent-name rule. `FormResponsesView`'s `getRespondentName`
  now calls it, which is what "reuse the existing logic" has to mean if the two are not to
  drift.

## Cell contents

`CellContent` is `{ text, summary?, node? }`. `text` is the full rendered text: it is what
search matches, what the comparators fall back on, and what a row shows once expanded.
`summary` is the collapsed one-liner where CSS clipping will not do, which today is only
`list`. `node` replaces the text for the cells that are not text at all.

A checkbox renders an icon, so it has no visible text to match. Its `text` is `Yes` / `No`,
which is also the icon's `aria-label`, so the accessible name is the display text. The same
goes for `contract`, whose `text` is the field's own yes/no labels.

Searching a `list` matches its full text rather than its collapsed summary, so a match can
be in an entry the collapsed row does not show. Expanding the row reveals it. Matching only
the summary would make the other entries unsearchable, which is worse.

`custom` answers are strings, so they render as text. `date`, `time` and `timezone` render
the stored string unchanged: answers are already ISO-ish, and reformatting a `YYYY-MM-DD`
through `new Date` shifts it a day in half the world's timezones. The comparator parses to a
timestamp, so the ordering is chronological either way. Only the `Submitted` column, which
holds a real instant, is formatted.

`file` links to `imageSrcFromKey(key)` with the stored key as the link text, since the key
is the filename.

## Which field definition renders a cell

The column header carries the current wording, but each cell renders through the field as
that response's own snapshot defined it, looked up in a per-snapshot map. Option labels get
reworded between versions, and showing today's label over an answer picked under the old one
misattributes it.

## Expanding a row

The spec asks both that clicking a cell expand its row and that clicking a row open the
drawer. Every row has a chevron toggle in a sticky gutter, and a cell whose content is
clipped, meaning it has a `summary`, holds a newline, or runs past 48 characters, toggles the row
as well. Anything else in the row opens the drawer. Cells with nothing hidden have nothing
to expand, so they go to the drawer.

## Column derivation

- Column ids are `q:<fieldId>` for questions and the bare `MetaColumnId` for metadata, so a
  field id can never collide with a metadata column.
- A field with no label reads `Untitled <kind>` from `FIELD_KIND_NAMES`, with the id in the
  header's `title`.
- Retired columns sort by the last snapshot that carried them, newest first, and keep schema
  order within a snapshot.
- Versions order by snapshot id. It is a serial primary key, so a higher id is a later
  version, and the responses alone never carry a snapshot's `createdAt`.
- The focused-to-expanded switch fires only on an orphaned answer whose field id some loaded
  snapshot still declares. An id no snapshot declares gets no column in either mode, so
  switching would not reveal it.

## Snapshot navigator

The drawer needs each version's `createdAt`, which no prop carries. It fetches
`tasksGetResponseSnapshotMigrationAdmin` per form id, lazily, only while the drawer is open.
That endpoint already exists and already backs `/forms/:formId/snapshots`, so this adds no
server work. Everything else in the drawer comes from the responses already in memory: the
response counts, the date ranges, the per-version diff. If the fetch fails, the entry
says the date is unavailable and the rest still renders.

The side-by-side diff runs over each version's question fields reduced to id, kind, label,
required and option labels. Raw snapshot JSON diffs are unreadable: every save churns
builder bookkeeping that means nothing to an admin.

## URL writes

`useSearchParams`' setter hands its updater the params of the render that created it, and
takes a new identity on every URL change. A debounced write therefore applies to a stale URL
and silently undoes whatever landed in between. Typing in the search box and then cycling a
column's sort reproducibly lost the third click. Writes now go through a ref holding the live
params and setter. `ResponsesTable.tsx` carries a comment saying so.

## Scope read wider than the `responses` tab

Two changes reach outside the tab, both traceable to a line in the spec.

- **Variant chips.** "Replacing the current blue pill" can only mean the pills in the Replays
  and Questions tabs, since the new table had no pill to replace. Both now use
  `IdentityChip`. The tabs' behavior is untouched; only the chip's appearance changed.
- **Release date.** "The page header shows the form's release date beside the title" puts it
  in `FormResponsesView`'s header, which every tab shares, so it shows on all four.

## Variant scoping

The tab gets `scopedResponses`, not the full `responses` list, so the variant dropdown that
already sits in the page header narrows the table the way it narrows every other tab. The
release date still comes from the full list, as specified.

## Dependencies

`@tanstack/react-table` went into `apps/admin` and `apps/frontend` at `^8.21.3`. It owns the
column model, the visibility state, the sort state and the sorted row model. Search filtering
is a plain `useMemo` over the rows instead: its global filter does not know which columns are
hidden, and a pure function is what the tests want anyway.

`zod` is now declared in `apps/admin/package.json` at the same `^4.3.6` the other web
packages use, because the stored view read back from localStorage is validated there.

# Decisions

Agent-made choices while implementing the HTML export. None of these came from Alex.

## Withdrawal has no date to print

REQUIREMENTS asks for `withdrawn="false"` or "the withdrawal date from `withdrawnUserMap`".
`ActionWithdrawalDto` carries `userId`, `declineReason`, `isMoral`, `outOfTime` and no timestamp,
so there is no date to print. `withdrawn` is `"true"` or `"false"`, and a `withdrawal-reason`
attribute carries whatever detail exists (`out of time`, `moral objection`, the free-text reason),
joined with `; `. The CSV's Withdrawn column reads the `withdrawn` attribute, so it is `true`/`false`.

## Snapshot schemas are parsed element by element

`formSchema` is strict and its pages hold a discriminated union, so one element written before its
kind was renamed fails the parse for a whole snapshot. Snapshots here are historical by definition,
so the walk tries `anyFieldSchema`, then `fieldGroupSchema`, then `displayBlockSchema` per element
and skips what none of them accept. Same tradeoff `common/src/forms/stored-schema.ts` already makes
for the question picker. A stale block costs one block, not a page of context.

## `buildResponsesHtml` takes `exportedAt` and `csvFileName`

REQUIREMENTS asks for a pure function. `new Date()` and the filename sanitizer both live in the
component, and the function takes their results as parameters.

## The lib declares its own form and variant shapes

`FormWithSchema` and `ResponseVariantOption` are exported from `FormResponsesView.tsx`. Importing
them back into `lib/` would point the module graph from a lib at a component, so the lib declares
the two structural shapes it actually reads (`id`/`title`/`formSnapshotId`/`schema`, and
`formId`/`name`). The component's types satisfy them.

## Which variant gets the current-schema block

In merged mode the component's `form.schema` is not any variant's schema: `ActionMergedResponsesTab`
merges the default form's schema with a synthetic page holding variant-only fields, so the aggregate
views can see them. Emitting that as every variant's "current" schema would be a lie, so the
current-schema block is emitted only inside the variant whose `formId === form.id`. Other variants
show exactly the snapshots their responses reference.

## Responses that match no variant

A response whose `formId` is not in `variantOptions` gets its own `<variant form-id="N" name="form N">`
block rather than being dropped, since the export's whole premise is that nothing is filtered out.

## Markup beyond the shape in REQUIREMENTS

The reference document shape left a few things unstated; these are additions, not changes:

- `<answer>` holds `<field-id>` and `<field-label>` children. The toggle swaps which one shows with
  CSS, which is what "no re-rendering, no data duplication in JS" asks for.
- `<question kind="list">` lists its sub-fields as `<sub-field id kind>`, so a `<sub field="x">` in a
  response resolves to a question.
- `<sub>` carries a `label` attribute alongside `field`, and labels mode shows the label. Without it
  a list answer reads as a column of generated field ids.
- `<respondent>` carries `withdrawal-reason` (see above).
- `<page>` carries a `<description>` child when the page has one, since respondents read it.
- `html` display blocks emit their markup as escaped text. Live HTML inside the export would style
  the document and could carry a link out.

## Flattening multi-part answers into a CSV cell

A `<pretty>` holding `<item>`/`<sub>` children has no separators in `textContent`. The script walks
the children and joins with `; `, prefixing each `<sub>` with its field id (raw mode) or its label
(labels mode). Nested `<item>` rows join the same way.

## What counts as unanswered

`null`, `undefined`, a blank string, an empty array, an empty object. `false` is an answer, so an
unchecked checkbox renders as a value rather than as a gap. Matches `isEmptyAnswer` in
`responses-table/columns.ts`.

## Snapshot with no responses sorts last

Snapshots sort by their earliest response. The synthetic current-schema block has none, so it sorts
with `+Infinity`, which puts it last as REQUIREMENTS asks.

## Tests

`apps/admin/src/lib/responsesHtmlExport.test.ts` covers the raw/pretty pair per answer, unanswered
and orphan answers, escaping of markup in answers and the title, snapshot ordering, and the absence
of external references. Alex did not ask for tests; the escaping case is the one worth a regression
guard, since a free-text answer rendering as markup is the failure that matters.

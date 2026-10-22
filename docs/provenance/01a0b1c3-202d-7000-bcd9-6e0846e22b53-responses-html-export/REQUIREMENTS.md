---
user: Alex Dorey
task: Add a self-contained HTML export next to the admin "Export CSV" button
---

# Requirements

## What to build

- In the admin panel, wherever "Export CSV" appears above a table of form responses, add a
  second button that downloads a single self-contained `.html` file. A staff member can open it
  in a browser and read it, or paste/upload it into an LLM.
- The document body is XML-ish: custom tags, nested, styled with `display: block`. A `<script>`
  at the bottom walks the rendered DOM and turns it into a CSV the user downloads with a button.
- Everything is generated in the browser from data the page already has. No new server endpoint,
  no new API call, nothing fetched by the generated file at runtime.

## What must not change

- The existing CSV export stays exactly as it is: same button, same behavior, same code.
  Do not refactor `csvEscape` or `handleExportCsv`; do not share code between the two exports.
  The new button is additive.
- Touch nothing else in `FormResponsesView.tsx`. The CSV path, its button, and `exportFileBase`'s
  doc comment stay as they are.

## Scope of the export

- The HTML dumps every response the view has loaded, regardless of on-screen filters, variant
  selection, tab, or pagination. Filtering is the reader's job downstream. The CSV button beside
  it keeps exporting the currently scoped responses; that difference is intended.
- Drafts are out of scope (the endpoint does not return them; do not add them).
- Snapshots with zero responses are out of scope, except the form's _current_ schema
  (`form.schema`), which is included as its own block marked current even when no response
  points at it.

## Document structure

- Root element `<form-export>`, custom tags throughout, one `<snapshot>` block per distinct
  `formSnapshotId`, each holding its schema and the responses submitted against it.
- Snapshots ordered oldest first, by earliest response `createdAt`; the current-schema block last.
- When `variantOptions` is set, wrap each form's snapshots in
  `<variant form-id="212" name="Variant B">`.
- Every question carries both a raw value and a human-readable rendering.
- Escape `& < > "` in all text and attributes. A free-text answer containing markup must never
  render as markup.

Alex supplied this reference shape:

```html
<form-export form-id="140" title="Participate in Alliance governance form">
  <export-meta>
    <exported-at>2026-09-17T18:04:00.000Z</exported-at>
    <response-count>133</response-count>
    <snapshot-count>2</snapshot-count>
    <first-response-at>2026-02-11T09:22:41.000Z</first-response-at>
    <last-response-at>2026-09-12T17:03:08.000Z</last-response-at>
  </export-meta>

  <snapshot id="881" current="false" response-count="13">
    <schema>
      <page index="1" title="Why this matters">
        <display kind="header">Alliance governance</display>
        <display kind="text"
          >Members vote on which campaigns the Alliance runs next…</display
        >
        <question id="q_familiar" kind="radio" required="true">
          <label
            >How familiar are you with how the Alliance picks campaigns?</label
          >
          <description>Pick the closest.</description>
          <option value="option1">Not at all</option>
          <option value="option2">Somewhat</option>
        </question>
        <group id="g_contact" label="How to reach you">
          <question id="q_city" kind="city"
            ><label>Where do you live?</label></question
          >
        </group>
      </page>
    </schema>
    <responses>
      <response id="18422" submitted-at="2026-03-02T15:11:09.000Z" device="web">
        <respondent user-id="8123" withdrawn="false"
          >Jane Doe &lt;jane@example.org&gt;</respondent
        >
        <answer
          field="q_familiar"
          kind="radio"
          label="How familiar are you with how the Alliance picks campaigns?"
        >
          <raw>option2</raw><pretty>Somewhat</pretty>
        </answer>
        <answer
          field="q_topics"
          kind="multiselect"
          label="Which topics matter to you?"
        >
          <raw>["AI_data_use","e-waste"]</raw>
          <pretty><item>AI data use</item><item>E-waste</item></pretty>
        </answer>
        <answer field="q_city" kind="city" label="Where do you live?">
          <raw
            >{"id":5391959,"name":"San
            Francisco","admin1":"CA","countryName":"United States"}</raw
          >
          <pretty>San Francisco, CA, United States</pretty>
        </answer>
        <answer
          field="q_notes"
          kind="textarea"
          label="Anything else?"
          unanswered="true"
        ></answer>
      </response>
    </responses>
  </snapshot>
</form-export>
```

Details Alex specified:

- `<respondent>` text is `User name <email@example.com>` when the user is known, falling back to
  what `respondentName()` already produces (`anonymous`, `anonymous invited by X`). Attributes:
  `user-id`, `sid` when present, `withdrawn` (`"false"`, or the withdrawal date from
  `withdrawnUserMap`).
- `<answer>` is emitted for every question in that snapshot's schema, in schema order, including
  unanswered ones (`unanswered="true"`, empty). An answer whose field is not in the snapshot's
  schema (stale key) still gets an `<answer field="…" orphan="true">`. Do not silently drop data.
- `<pretty>` rendering per field kind, branched with an exhaustive `switch` or a
  `Record<FieldKind, …>` per the repo's enum-branching rule:
  - option kinds (`radio`, `select`, `checkbox`): the option label for the stored value, falling
    back to the raw value when no option matches.
  - `multiselect`: one `<item>` per selection, labels resolved.
  - `ranking`: `<item rank="1">Label</item>`, in stored order.
  - `city`: `name, admin1, countryName`, skipping missing parts.
  - `list`: `<item index="1"><sub field="x">value</sub>…</item>` per row.
  - `range`/`number`/`date`/`time`/`timezone`/`text`/`textarea`/`email`/`phone`: the value.
  - `contract`/`file`/`custom` and anything else: the stored reference or `JSON.stringify`.
- `<raw>` is the stored value verbatim: a string as-is, anything else `JSON.stringify`d.
- `<question>` blocks carry `required`, `kind`, `description`, options, and, when present, a short
  note that the field is conditional (`visible-if="true"`).
- Display blocks matter: include headings, body copy, quotes, labels, accordion section titles and
  bodies, link text, and transcript text respondents actually read, in place, so an LLM can see
  the context each question was asked in. Media blocks (`images`, `video`) can reduce to their
  alt/caption/URL. `divider`/`spacer` can be dropped.

## Styling

Inline `<style>`, enough to be pleasant, no framework:

- Every custom tag that should stack gets `display: block`.
- A readable system font stack, max content width, generous line height.
- Alternating shaded backgrounds on `<response>`, a visible border between snapshots.
- `<raw>` in a small monospace face, muted color; `<pretty>` in the body face.
- Question labels and display-block headings visually distinct from answers.
- A sticky toolbar at the top holding the toggle and the download button.

## The embedded script

Plain ES5-safe-ish DOM JavaScript at the bottom of the generated file, no imports, no network.
Two toolbar controls:

1. Values / labels toggle. The document ships showing raw stored values. The toggle flips a class
   on `<body>` (`mode-raw` / `mode-labels`) and CSS swaps which of `<raw>`/`<pretty>` is visible;
   the same toggle swaps `<answer>` headings between the field id and the question label. No
   re-rendering, no data duplication in JS.
2. Download CSV, built by walking the rendered DOM (`querySelectorAll` over `snapshot`,
   `response`, `answer`), not from a JSON blob:
   - One row per `<response>`, in document order.
   - Meta columns first: Response ID, Submitted At, Snapshot ID, Variant (only when the document
     has `<variant>` blocks), Respondent, User ID, SID, Withdrawn.
   - Then one column per distinct `field` across every snapshot, in first-seen order, so a form
     whose questions changed still lines up. Blank where a snapshot lacked that question.
   - Cell text and header text follow the current toggle state: field ids + raw values in
     `mode-raw`, question labels + pretty values in `mode-labels`. Deduplicate repeated header
     labels (`Label (2)`).
   - Proper CSV quoting (`"` doubled, fields containing `",\r\n` quoted), newlines inside a cell
     preserved inside quotes, UTF-8 BOM so Excel opens it correctly.
   - Downloads as `<same base name>-responses.csv` via a Blob + object URL.

## Wiring

- New file `apps/admin/src/lib/responsesHtmlExport.ts` exporting a pure
  `buildResponsesHtml(params): string`: no React, no DOM APIs, just string building, with the
  embedded script and styles as constants in that file.
- In `FormResponsesView.tsx`: a `handleExportHtml` callback next to `handleExportCsv` that calls
  `buildResponsesHtml`, wraps the string in a `text/html` Blob, and downloads
  `${sanitize(exportFileBase)}-responses.html` using the same object-URL-and-anchor approach the
  CSV export already uses. Disabled when `responses.length === 0` (not `scopedResponses`, since
  this export ignores filters).
- Render the new button immediately after `Export CSV` in the same toolbar, same `size="small"`,
  labelled `Export HTML`, `ButtonColor.White` so `Export CSV` stays the black primary. Both labels
  stay explicit about the format; no icon-only control, since "which file do I get" is not
  something an icon says unambiguously.

## Done when

- `bun run typecheck` passes in `apps/admin`; `bun run format` is clean.
- `git diff` shows no change to `csvEscape`, `handleExportCsv`, or the `Export CSV` button, and
  clicking `Export CSV` still downloads the same file it did before.
- In the local admin panel, exporting `/forms/5/responses` ("Reliability form 25OCT28 update",
  ~378 responses across ~25 snapshots) and `/forms/140/responses` ("Participate in Alliance
  governance form") each produce a single `.html` file that:
  - opens in a browser and reads cleanly top to bottom, with snapshots, schema text and responses
    all visible;
  - toggles between raw values and labels without breaking layout;
  - downloads a CSV whose row count matches the response count and whose columns line up across
    snapshots with different questions;
  - contains no `<script src>`, `<link href>`, `fetch`, or any other external reference.
- Exporting from an action dashboard with variants produces one file grouping variant → snapshot →
  responses.
- Pasting the HTML into an LLM and asking "what did respondents say to question X, and what exactly
  were they asked?" is answerable from the file alone.

## Reading list Alex named

`AGENTS.md`, `skills/provenance/SKILL.md`, `skills/unslop/SKILL.md`, `skills/trim-comments/SKILL.md`.

---
agent: Codex (planning), Claude Opus 5 (implementation)
---

## Formula value

A list input gives the formula an array with one record per stored row, in answer order. Each record has one property per readable sub-field that has a name in the input's mapping.

For a list input named `input1` with `name`, `age`, and `roles` properties, a formula sees:

```js
[
  {
    name: "Ada",
    age: 34,
    roles: [{ label: "Engineer", value: "engineer" }],
  },
  { name: "Lin", age: undefined, roles: undefined },
];
```

Each cell goes through `formValueToExprValue`, the same conversion a top-level field gets. Blank, invalid, unanswered, and row-hidden cells read as `undefined`. File and custom-component sub-fields get no property. A list with nothing readable still gives one empty record per row, so `input1.length` works.

An unanswered list (no stored value) reads as `[]`. The live form draws `defaultNumber` empty cards before the respondent touches the list, but none of them is stored or submitted, so the formula doesn't count them either.

## Schema shape

A list input is a new input kind, `{ kind: "list", fieldId, properties }`. `properties` maps sub-field id to property name. Keying by id keeps a name stable when the sub-field is relabeled or moved. A `field` input pointing at a list, and a `list` input pointing at anything else, fail validation.

## Naming properties

`syncListInputProperties` keeps every existing name, names each unmapped readable sub-field from its label (`camelCase(deburr(label))` from es-toolkit, stripped to `[A-Za-z0-9_]`), and drops names for sub-fields that were removed or are unreadable. A blank label becomes `field`, a leading digit gets a `field` prefix, and collisions get `2`, `3`, … suffixes. `constructor`, `prototype`, and `__proto__` count as taken, because the evaluator refuses to read them.

The sync runs in two places:

- The variable builder shows synced variables, so an author sees names for sub-fields added since the variable was last edited, and any edit stores them.
- `FormBuilder.saveForm` syncs before validating. I picked save time over syncing on every schema change because a new sub-field starts with a placeholder label like "Text". Naming it at creation would bake that placeholder in. By save time the label is final.

Validation still demands that the stored mapping covers exactly the readable sub-fields, with valid, unique, non-reserved names. Schemas that skip the admin save path (merges, direct API writes) get an error instead of a quiet fix.

## Renaming a property

No formula rewriting. After a rename, the type check reports the old name as a missing property. Rewriting `row.oldName` safely means knowing which identifiers are bound to that list's rows, including through `find`, `at`, and index reads. Getting that wrong would silently change a formula, which the requirements forbid.

## Row visibility

`VariableResolutionContext` takes `isListSubFieldVisible(subField, data)`, where `data` is the form's answers with the row's cells on top, the same merge the list renderers and `getListSubFieldErrors` use. A hidden cell reads as `undefined` even if a value is still stored.

- The live form (web and mobile, via `useFormVisibility`) passes `visibilityExtras` without `readOnly`. In read-only mode, `isElementCurrentlyVisible` treats any stored value as visible, which would break the requirement that stored values under hidden sub-fields don't count.
- The builder preview treats every sample cell as visible. Sample rows have no other answers to evaluate conditions against.
- The server strips with the respondent's account state and device before storing, so a response saved from here on carries no hidden cell. One saved before still can, so `resolveOutputItems` strips again on the way out, against the same field lookup the server strips with, and the output view reads the same rows it draws.
- That second strip reads a condition the response can't replay as unknown. A condition on the respondent's account state or on another form's answers never replays; one on the device or on a validator verdict replays only where the response recorded that, which an older one often didn't. Guessing at any of those would drop a cell the respondent filled in plain sight. `isVisibleInSavedResponse` drops a cell only where the conditions that do replay rule it out whichever way the unknown ones went, so `gate = 1 AND user has a city` still drops a cell when the response says `gate` is 2. A condition on another field whose own visibility doesn't replay still counts where that field's answer and no answer give the same verdict: a hidden field reads as unanswered, so `gate = 1` is false either way when the response says `gate` is 2. A whole field gets the same re-check in `isAnswerShown`.
- A field's group and page gate it the same way its own conditions do, since the server strips an answer its page hides too. `isElementCurrentlyVisible` checks the page only for a caller that passes `pageByFieldId`, so a condition on a field whose page is hidden reads it as unanswered here without changing the live form, which checks pages separately.

## Blank cards in an output view

An output view draws a list card's sub-fields only when the view doesn't hide them and the card answers them. A card left with none of those is not drawn, and a list with no such card is left out the same way as an unanswered field, label included. Output rendering and counting use the same filter without applying form row visibility again, so a caller's row context cannot make a counted card disappear. The shared filter lives in `shared/forms/outputValues.ts` so list-card helpers do not depend on the output resolver.

The web test counts the card boxes through the classes `Card` and the list branch of `RenderField` give them, which keeps a test hook out of the shipped markup, where nothing else in the repo carries one. Counting the controls a card renders instead would pass either way, because a card the view has nothing to show for renders no control whether or not its box is left out.

The `textonly` and `card` formats draw a count of the rows rather than the rows themselves. That count is of the cards the view has something to show for, not of every row the respondent added, so one saved answer can't read two ways in the same view, with the block that draws the cards gone while the count beside it says three. It also stops a list whose sub-fields the view all hides from reporting how many rows there were.

`asCards` decides which cards a list answer has. Both renderers already read the answer through it, and it moved to `form-schema.ts` so `isOutputBlockVisible` can read it too. It returns nothing for an answer that isn't a list of rows, so one bad entry leaves the field with no cards to draw and the block is left out. Judging those entries one at a time would keep the label over an empty box for an answer like `[null, { name: "Ada" }]`, which a response stored before the server checked the shape can still hold.

Malformed public list answers produce a diagnostic naming the field, so an omitted answer can be investigated. It goes to the console for whoever has devtools open and to PostHog as `MalformedListAnswer`, since `resolveOutputItems` runs on clients whose consoles the team never sees. The diagnostic omits the answer contents. `resolveOutputItems` checks each distinct field referenced by the selected view once, so a list block and its count block produce one diagnostic per resolution. Private answers and hidden input fields produce no diagnostic. Visibility predicates stay free of logging because multiple blocks can evaluate the same answer.

## Sample answers in the output builder preview

The preview pane beside an output view makes up an answer for every field so the author can see the view take shape. A list had no case of its own and fell to the default, a sentence of text. That isn't a list of rows, so the block drew its label over nothing. `buildPreviewAnswers` now calls itself on the sub-fields, which hands back one row holding the sample cell each sub-field would get on its own. One row is enough to show the layout and which sub-fields the view hides.

## Preview

For a list input, the builder shows one name box per readable sub-field and a sample-row editor. Authors add and remove rows, and each cell uses the existing `SampleAnswer` control for its kind. Cells go through `readSampleAnswer`, the same path as scalar samples, so the preview gets the same record shape and conversions as a live form. The first bad cell is reported by row and property.

## Validation and failures

The type environment declares a list input as `{ name: T | undefined; … }[]`, where each `T` comes from the sub-field's kind. Invalid or repeated names are left out of that type, so each problem gets one validation error instead of an extra TypeScript syntax or duplicate-identifier error.

The existing renderability check already rejects a formula that ends on an array or a record, and the tests cover `input1`, `input1[0]`, and `input1.map(p => p.roles)`. Runtime formatting didn't change. A formula that passes validation can't end on a list or record, and changing `formatVariableValue` would change existing scalar behavior that a test pins down.

`join` carries a `this` type in `formula-lib.ts`, so joining a list of rows, choices or lists is a type error rather than a formula that passes and shows `[object Object]`. TypeScript's wording for that error names the `this` context, so `MESSAGE_OVERRIDES` replaces it with one that says to name a part of each item first. `join` is the only library member whose `this` type can fail to match, and a test in `formula-lib.test.ts` holds that, so the override can't catch anything else.

## Scope and compatibility

The list resolver lives in `common/src/forms/variables.ts`, which the web and mobile forms (`shared/useFormRenderer.ts`) and saved-response output (`shared/outputrenderer.ts`) already share. Variables recompute whenever answers or visibility extras change.

Any variable that fails blocks the form, web and mobile, with the "This form can't be displayed" notice an unknown element or condition kind already gets. I read "the variable calculation fails" as every failure `evaluateVariable` reports, not only an unknown input kind. The evaluator doesn't throw on answers, and the admin rejects a formula that doesn't compile, so a failure in practice means a newer admin saved something this build can't calculate. Answers typed mid-form shouldn't trip it. The admin's builder preview renders the unsaved schema, so it shows the same notice while a formula there is broken. There the notice names the variable and why it failed, in place of the line about refreshing, which can't fix a draft. The admin's response views get the same message, since refreshing can't fix a formula in a response's snapshot either.

An output view isn't blocked. A variable that fails there gets no value, so its `#{name}` shows as written, which is what `interpolateVariables` already does for a name it has no value for. The other variables still fill in. One bad variable in a feed card shouldn't hide the card, and the raw token still shows something is wrong.

An input kind the running build doesn't know fails the variable rather than throwing, so an older app build that meets a kind added later shows the "This form can't be displayed" notice instead of crashing. An admin tab left open across a deploy can meet one too. Saving there reports the input as an error that says to reload, next to the form's other errors. A field kind it doesn't know can't be picked as an input, a variable that reads one fails the same way, and saving reports that input as an error that says to reload. Reading it as `undefined` would pass for an unanswered field, so a formula's `??` fallback would show on an answered form.

No migration. Existing `field` inputs keep their shape and behavior. es-toolkit was added to `common/package.json`, at the same version range `apps/frontend` already declares.

## Submitted answers

Submit parses answers with `readFormAnswers`, the check the draft endpoint already uses, and answers 400 when one isn't a `FormValue`. That rejects a list row or cell of any other shape, where the row check alone let a card like `{ notes: { deep: 1 } }` be stored. A top-level `null` is dropped first rather than rejected, because an e2e test from the ranking field pins that submit accepts one. No client sends either. The row check stays for a list answered with a `string[]`, which `formValueSchema` allows.

Guest submit and opt-out skip `validateFormSubmission`, since neither has the respondent's account state and an opt-out is partial by design. `createAndSaveFormResponse`, which every path saves through, runs both shape checks instead: the `FormValue` parse, and `readListAnswer` on each list field in the snapshot. The list check has to know the field's kind, because a string or `string[]` is a valid `FormValue` but not a list answer. Submit runs both twice, which costs little and keeps the save point the one place that decides what gets stored.

## Form snapshot schemas

`formSchemaOf` runs `formSchema` on every read of a form snapshot's schema and logs a snapshot that fails, but it serves the stored row either way. A refinement added after a row was written can fail it, and throwing would take that form down. Returning the parsed value would fill in defaults like a previous-answer block's `showLabel`, which changes 38 of the 1,859 form snapshots in the staging copy of prod. An older mobile build sends the schema it got back as `schemaSnapshot`, and `findHistoricalBySchemaOrThrow` would then miss it on hash. The three staging snapshots that failed, form 114's duplicate option value, were fixed by hand in prod, so the log starts out quiet. It checks each snapshot once per server process. Snapshot rows never change, so a second parse can't find anything new, and a failing snapshot that saved responses point at can't be fixed, so logging every read of it, once or twice per activity in the feed, would bury the next new failure.

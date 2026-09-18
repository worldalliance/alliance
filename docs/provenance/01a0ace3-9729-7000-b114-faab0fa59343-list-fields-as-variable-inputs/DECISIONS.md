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
- The output renderer passes the device type and validator results it already uses for block visibility.
- The builder preview treats every sample cell as visible. Sample rows have no other answers to evaluate conditions against.

## Preview

For a list input, the builder shows one name box per readable sub-field and a sample-row editor. Authors add and remove rows, and each cell uses the existing `SampleAnswer` control for its kind. Cells go through `readSampleAnswer`, the same path as scalar samples, so the preview gets the same record shape and conversions as a live form. The first bad cell is reported by row and property.

## Validation and failures

The type environment declares a list input as `{ name: T | undefined; … }[]`, where each `T` comes from the sub-field's kind. Invalid or repeated names are left out of that type, so each problem gets one validation error instead of an extra TypeScript syntax or duplicate-identifier error.

The existing renderability check already rejects a formula that ends on an array or a record, and the tests cover `input1`, `input1[0]`, and `input1.map(p => p.roles)`. Runtime formatting didn't change. A formula that passes validation can't end on a list or record, and changing `formatVariableValue` would change existing scalar behavior that a test pins down.

## Scope and compatibility

The list resolver lives in `common/src/forms/variables.ts`, which the web and mobile forms (`shared/useFormRenderer.ts`) and saved-response output (`shared/outputrenderer.ts`) already share. Variables recompute whenever answers or visibility extras change.

No migration. Existing `field` inputs keep their shape and behavior. es-toolkit was added to `common/package.json`, at the same version range `apps/frontend` already declares.

## Submitted answers

Submit parses answers with `readFormAnswers`, the check the draft endpoint already uses, and answers 400 when one isn't a `FormValue`. That rejects a list row or cell of any other shape, where the row check alone let a card like `{ notes: { deep: 1 } }` be stored. A top-level `null` is dropped first rather than rejected, because an e2e test from the ranking field pins that submit accepts one. No client sends either. The row check stays for a list answered with a `string[]`, which `formValueSchema` allows.

## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split. Rendered output stays the same.

## Layout

The split follows the one mobile's `RenderField` got, so a field kind lives in a file of the same name on both platforms:

- `fieldParts.tsx`: `RenderLabel`, the label id hook, the input class helpers, `ValidationMessage`, and `FieldInputProps`, the props every extracted field takes.
- `PhoneInputField.tsx`, `TimeInputField.tsx`: moved as they were, now taking `FieldInputProps`.
- `TextFields.tsx`: text, email, and date share `SingleLineInputField`, which differ only in input type, placeholder, and focus ring; textarea and number get their own components.
- `ChoiceFields.tsx`: range, radio, select, and multiselect, each computing its own option sections, so `RenderField` stops computing them for every kind.
- `FileInputField.tsx`, `ContractInputField.tsx`, `CheckboxInputField.tsx`. Checkbox stays in mobile's `RenderField`, where it is a few lines around a `Checkbox` component; on web its markup is the input itself, and moving it leaves `RenderField` well under the limit rather than just under it.

`RenderField` keeps the no-options guard, the dispatch, and the kinds whose markup is a few lines around another component: timezone, city, list, custom, and ranking. List stays because its cards render `RenderField` recursively.

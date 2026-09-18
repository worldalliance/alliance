---
user: Charles Lien
task: Allow list fields to supply inputs to form variables
---

## Requested behavior

The user asked:

> make it so that list field elements can be used as input to the js interpreter for variables in forms

After comparing a list sub-field input with a whole-list input, the user chose the whole list. A list input therefore supplies an array of row objects rather than one array per sub-field.

## Approved proposals

The user approved the agent's proposals that:

- An empty list supplies `[]`. Every list row remains represented, and an unanswered or unusable cell supplies `undefined`.
- Every sub-field kind already readable by a variable remains readable inside a list. File and custom-component values remain unavailable.
- The variable preview lets the author add and remove multiple sample rows.
- List inputs work wherever variables already run, including web forms, mobile forms, live interpolation, and saved-response output.
- Row properties use stable, editable aliases generated from the sub-field labels rather than internal IDs or positions.
- Every readable sub-field appears in each row object.
- Row-property aliases belong to each variable input.
- A list with no readable sub-fields remains available so a formula can use its row count.
- A sub-field hidden for a row supplies `undefined`, including when an old value remains stored.
- A formula must end in text, a number, yes/no, or no value. Returning a list or row object produces an explicit validation error rather than implicit string conversion.

## Implementation discretion

The user left alias-renaming behavior to the implementation agent because the preferred behavior depends on maintenance cost. The implementation may rewrite safe formula references or report a validation error after the rename. It must not change a formula's meaning silently.

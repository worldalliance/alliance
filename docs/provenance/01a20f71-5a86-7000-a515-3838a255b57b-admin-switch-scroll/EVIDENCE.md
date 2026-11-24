# Evidence

## The switch click scrolls the document

Method: a Playwright script in installed Chrome, 1400×1000, signed in as an admin, opened action 184's Action details tab on the local admin and clicked the Staff Preview switch's label, reading the checkbox's offset parent and every element's `scrollTop` before and after. Checked 2026-11-24 on `origin/main` at 917bc4735 with the local db loaded from staging.

- Static label: the checkbox's offset parent was `<body>`, and after the click the document (`<html>`) had `scrollTop` 683, leaving the screen below the layout blank.
- `relative` label: the offset parent was the label, and the document's `scrollTop` stayed 0 after the click; the switch turned on.

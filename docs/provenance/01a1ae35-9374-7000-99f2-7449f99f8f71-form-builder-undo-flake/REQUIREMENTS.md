---
user: Charles Lien
task: Fix ALL-1941, the flaky FormBuilderHistory test "undoes a contract question with the contract it defaults to", and open a PR.
---

# Requirements

- `apps/admin/src/components/FormBuilderHistory.test.tsx` › "undoes a contract question with the contract it defaults to" stops failing intermittently, keeping what it asserts: after undo, the contract question is gone and Undo is disabled. (user-originated)
- The test waits on observable state (`waitFor` / `findBy*`, or the Undo button's enabled state) instead of counting `nextTask()` ticks. Other tests in the file change only if they share the same race. (user-originated)
- If the form builder's undo history is itself wrong, fix it and say so. (user-originated)
- Show the fix with repeated runs of the file, alone and while the machine runs another test suite, with before and after counts in the PR description; say plainly if the flake doesn't reproduce before the fix. (user-originated)
- A shared test helper beside `apps/admin/src/lib/testing/EditorSidebar.tsx` renders a field editor in its settings sidebar: `MemoryRouter` > `SiteAppProvider` > a no-op `CustomValidatorDraftsContext` > `EditorSidebar`, with `queryWrapper()`. `EditableContractField.test.tsx` and `EditableCustomComponentField.test.tsx` use it, landing in its own commit before the contract-field change; the `EditableChoiceField`, `EditableChoiceField.formula` and `EditableRangeField` tests keep their own copies. (user-originated)

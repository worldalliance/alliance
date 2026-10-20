## Target

No other worktree's branch touches `DisplayBlockWrapper.tsx`, so this split can't collide with parallel work (REQUIREMENTS.md).

## Fix

The waiver defers splitting a file over the 500-line `alliance/max-lines` limit, so the fix is the split. Most of the file was the per-user content controls, which go into four new files in `apps/admin/src/components/display-blocks/`:

- `useManualTargets.ts` owns which user's content is on screen: the form builder's override target where there is one, else the block's own selection. It also owns the user list query, the paging through users, and the `TargetLabel` naming. The wrapper, the options panel, and the user list all read the one result.
- `ManualUserList.tsx` renders the "N set / M total" toggle and the searchable user list, and owns their open and search state. It renders only while per-user content is on, so turning it off, through the toggle or through undo, closes the list and clears its search. Before, the toggle closed the list but undo left it open, and the search persisted either way.
- `PerUserOptions.tsx` renders the per-user section of the options menu and sidebar: the toggle, the clipboard import button, the users with and without content, and clearing a user's content. Both places that render it already required a block and `onUpdate`, so it takes both as required props and drops its guards against their absence.
- `useClipboardImport.ts` holds the clipboard import, and the wrapper calls it rather than `PerUserOptions`. Outside the form builder's sidebar, `PerUserOptions` renders inside the options menu, which closes on any click outside it. An import in flight would then read the block through a ref that stopped updating, so it would skip asking before replacing text typed during the clipboard read. The wrapper stays mounted, so the ref keeps up.

`DisplayBlockWrapper.tsx` keeps the block chrome, conditional visibility, the per-user banner, and the render props for block editors.

## Tests

The paging, the user list's order and search, the chips for users with and without content, and clearing a user's content had no tests. `EditableCopyTextBlock.test.tsx` now covers them. The tests land before the split, so they pass against both versions. It also covers the list resetting when per-user content turns off, and an import started from the options menu asking before it replaces text typed after the menu closed.

## The hook

Pasting JSON creates an action, so it joins `createAction` in `useActionAdmin` as `pasteActionJson` rather than getting a hook of its own. `useActionAdmin` already owns every admin action write and what each one invalidates; a separate hook would put a second create beside it with its own copy of that list. The menu calls `useActionAdmin(null)`, as the new-action page does, so it fetches nothing.

## What it invalidates

The paste invalidates what `createAction` does: the all-actions list and the forms index. The server inserts the pasted task form and links it to the new action, so the forms index gains a row with `usedInAction`. The menu used to invalidate only the all-actions list, leaving the index stale for up to its 30-second stale time.

## Navigation timing

`mutateAsync` resolves after `onSuccess` settles, so the menu now opens the pasted action once the invalidated lists that are mounted have reloaded, as creating an action from the editor already does. The menu used to navigate without waiting.

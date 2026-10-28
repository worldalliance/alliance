## Target

`useFormDraftSync.ts` is a `use*.ts` file, so `named-hooks-only` doesn't flag it, yet it calls the generated client directly and hand-rolls what a query does: a fetch per form, a cancelled flag, and a reset when the form changes under a mounted renderer. The draft is server state keyed by form, written from more than one device, so it belongs to a query. A failed read also used to close the save path for the rest of the visit; the query now retries it under the apps' default policy, which skips refusals.

## The hook

The read is a `useQuery` under `queryKeys.taskFormDraft(formId)`. The save is a `useMutation` whose variables carry the form id, so a save armed for one form can't land on another. `useFormDraftSync` keeps its name, arguments and return value, so neither renderer's `useFormDraftState` changes.

The query is always stale (`staleTime: 0`), so every mount and re-enable reads again. The save path opens on a successful read with none in flight or paused offline (`fetchStatus` idle), and `serverDraft` stays null until then. Web keeps queries for a day and pauses reads while the browser is offline, so a form reopened offline would otherwise take the previous visit's cached draft as fresh and restore it over newer local answers. The point of that gate is that the read reflects what another device saved since. A cached draft served at mount, or kept by a renderer whose sync turns off and on again, would open the save path before any fresh read and overwrite the other device's draft, and mobile's five-minute `staleTime` would skip the read altogether. Focus and reconnect don't refetch, so the draft is read once per form opening or re-enable, as before.

A save doesn't write its result into the cache: the save's own answers are already on screen, and the restore effect skips a draft once the member has edited. The submit and withdraw paths don't clear the cache either. The server deletes the draft on both, the renderer pauses saving before either request, and the entry goes when the form unmounts.

The save runs whatever the browser's online state (`networkMode: "always"`), so a save made offline fails and shows as failed, as before. Under the default mode, web's online manager would pause each offline save silently and replay them all at once on reconnect, in no fixed order, so an older snapshot could land last while the device recorded the newest save's `updatedAt` as its own, and a later visit would restore the older one as if another device wrote it.

`saveFailed` stays component state set per save rather than the mutation's `isError`, which reads false while each new save is pending and would flicker the warning. The save's callbacks sit on the mutation, not on each `mutate` call, because TanStack fires per-call callbacks only for the latest call: a save overtaken by a later one that then fails would never record its `updatedAt`, and the next visit would restore the older server copy over newer local answers.

## Tests

The hook's tests run under mobile's cache defaults, so they see the hook's own options. Two new tests, one remounting against the same client and one turning sync off and on, check that the draft is read again, that neither a save nor the cached draft comes out before that read lands, and that the newer draft does after. A third remounts offline and checks the same until the paused read lands on reconnect. Another checks that a read retried after a failure opens the save path. The tests pass identity-stable arguments, as the renderers do with their state, because the mutation re-renders the host on each save. `useFormDraftState` and `useFormEditing` tests in `sharedweb` gain a query client.

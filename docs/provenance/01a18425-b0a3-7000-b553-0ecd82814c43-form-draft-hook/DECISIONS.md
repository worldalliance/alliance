## Target

`useFormDraftSync.ts` is a `use*.ts` file, so `named-hooks-only` doesn't flag it, yet it calls the generated client directly and hand-rolls what a query does: a fetch per form, a cancelled flag, and a reset when the form changes under a mounted renderer. The draft is server state keyed by form, written from more than one device, so it belongs to a query. A failed read also used to close the save path for the rest of the visit; the query now retries it under the apps' default policy, which skips refusals.

## The hook

The read is a `useQuery` under `queryKeys.taskFormDraft(formId)`. The save is a `useMutation` whose variables carry the form id, so a save armed for one form can't land on another. `useFormDraftSync` keeps its name, arguments and return value, so neither renderer's `useFormDraftState` changes.

The query keeps nothing past its form's lifetime (`gcTime: 0`). The save path opens on a successful read, and the point of that gate is that the read reflects what another device saved since. A cached draft served at mount would open the save path before any fresh read and overwrite the other device's draft, and mobile's five-minute `staleTime` would skip the read altogether. Focus and reconnect don't refetch, so the draft is read once per form opening, as before.

A save doesn't write its result into the cache: the save's own answers are already on screen, and the restore effect skips a draft once the member has edited. The submit and withdraw paths don't clear the cache either. The server deletes the draft on both, the renderer pauses saving before either request, and the entry goes when the form unmounts.

`saveFailed` stays component state set per save rather than the mutation's `isError`, which reads false while each new save is pending and would flicker the warning.

## Tests

The hook's tests run under mobile's cache defaults, so they see the hook's own options. A new test remounts against the same client and checks that the draft is read again and nothing saves before it lands; it fails without `gcTime: 0`. The tests pass identity-stable arguments, as the renderers do with their state, because the mutation re-renders the host on each save. `useFormDraftState` and `useFormEditing` tests in `sharedweb` gain a query client.

## The hook

Of the page's five raw reads, only the member's action relations are changed by a write on the page: the "+ Activity" select in each action row (`CreateActivityControls`) posts `actionsCreateActivityAdmin`, and then re-navigated to the page to rerun the whole loader. The relations and that write therefore move together into `useUserActionRelationsAdmin` (`apps/admin/src/lib/useUserActionRelationsAdmin.ts`) under `queryKeys.userActionRelationsAdmin(userId)`. The other four reads stay in the loader: nothing on the page writes them, so they have no cache to share.

`CreateActivityControls` takes a `create` callback instead of calling the SDK, and keeps its per-row pending state so recording an activity in one row doesn't disable the others.

## What a recorded activity refreshes

`createActivity` invalidates only this member's relations. The same write also changes every member's relations (the members list's `useActionRelationsAdmin`), the action's stats, its incomplete members, its completion curves and the group progress views, but each of those lives on another route and refetches on mount under the admin `QueryClient`'s default `staleTime` of 0, so invalidating them from here changes nothing an admin sees.

Re-navigating also reloaded the member and the other loader data. None of those carry anything an activity changes, so the hook reloads only the relations.

## Loading

The loader prefetches the relations without awaiting, the way it already prefetched the member. The relations are the second query to follow that rule, so `prefetchFromLoader` and `loaderPrefetchStaleTime` in `apps/admin/src/lib/queryClient.ts` now hold both halves of it for both queries: the loader always fetches, and the query stays fresh for ten seconds so the mount right after doesn't load it twice. The action table shows its own loading and failed-load states, per the root `AGENTS.md` rule to fail loudly, where a failed load used to render as "No actions tracked." A failed reload over relations already shown, such as the one after recording an activity, keeps the table and says it could not refresh, as the member and notification settings sections on the same page do.

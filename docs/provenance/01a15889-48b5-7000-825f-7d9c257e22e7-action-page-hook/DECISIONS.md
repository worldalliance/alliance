## The cache

`useActionHandlers` reads the action through `useAction`, so the action page on web and mobile, the activity feed page and `ActionLink`'s hover preview share `queryKeys.action(actionId)`. `useAction` also owns the page's optimistic writes to it: `markCompleted` and `markDeclined`.

## Freshness

`useAction` keeps a load fresh for five minutes so a re-hovered link reuses its preview. The page loaded the action on every mount and every id change, and other screens complete tasks without touching this key, so the page passes `staleTime: 0`: it shows a cached copy at once and still refetches, including when web keeps the page mounted across an id change. On web it also refetches on window focus and reconnect. `refetchOnMount: "always"` alone would skip the id change. It refetches when `isAuthenticated` changes, as before, since bootstrap sign-in doesn't clear the cache.

## Failure

As before, the load the page starts on mount or on an id or auth change reports a 404 as not found, now also when it lands over a cached copy, and a later 404 keeps the last payload. The hook snapshots `dataUpdatedAt` and `errorUpdatedAt` when that load starts and compares values rather than clock times, since a cache write and the render that reads it can share a millisecond. Any other failure keeps the last payload, cached or not, which React Query does by default: a cached copy beats an error screen when the server is down. A refetch on sign-in or sign-out no longer shows the spinner. A first load that fails with a 5xx or no response retries under the app's query retry policy before the page reports it.

## The route loader

`ActionPage`'s loader runs on the server for the social preview meta, outside React and the client's query cache, and fetches anonymously, so its result can't seed the viewer-specific cache. It keeps its direct calls; the lint waiver says why instead of carrying a TODO.

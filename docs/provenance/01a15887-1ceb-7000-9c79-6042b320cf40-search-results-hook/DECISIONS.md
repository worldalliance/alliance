## The cache

`useSearchResults` moves to `shared/lib/useSearchResults.ts` (the `api-client/named-hooks-only` lint rule wants client calls in a `use*` file) and reads `searchAll` through `useQuery` under `queryKeys.search(query)`. Web's `SearchBar` and mobile's search screen are its only callers and keep its return shape. The pure helpers stay in `shared/lib/search.ts`.

## Behavior kept

- Each query, the first included, fetches only after it has held still for `debounceMs`.
- While the next query loads, the previous results stay on screen and `loading` is true, so neither screen flashes "No results found". The hook keeps those results itself rather than through `keepPreviousData`, which would bring back results from before a clear: both screens clear the query whenever an item is chosen, and Enter on web would then open a stale result.
- An empty query fetches nothing and clears results, selection, and error at once.
- Each new result set selects its first item when `autoselectFirst`; a failed search selects nothing. The selection is derived in the render that shows the results, so it never points at an item from the previous set. A chosen item is remembered by the query whose results it was chosen from and its id, so a background refetch of that query keeps it selected even when the results change. Showing any other query's results, or none, forgets it, so going back to an earlier query selects its first result again. Structural sharing keeps a background refetch with unchanged results from resetting the selection.
- `retry` refetches the query, and `loading` stays true while it is in flight, so the error panel gives way as it did before.
- `loading` is true only while the results on screen don't yet answer the current query. A background refetch of results already shown doesn't count, so "No results found" stays up through it.
- A failed search reports its error at once, without retrying (`retry: false`): the next keystroke or Retry asks again, and each app's backoff would leave the dropdown blank for seconds first.
- A search runs even while the browser reports itself offline (`networkMode: "always"`), so it fails into "Couldn't search." with Retry, as before. React Query's default pauses the fetch, which the screens would show as "No results found".

## Behavior changed

- A repeated query shows its cached results immediately and refetches them in the background on both platforms. The hook sets `staleTime: 0`, as `useForumPosts` does, because results come from live users, actions, and posts, and mobile's app-wide five-minute `staleTime` would otherwise hide new ones from a repeated search.
- Web refetches a shown search when the tab regains focus. A failed refetch keeps the results on screen and reports nothing, as the other hooks do; only a search that never loaded shows the error. The hook clears on `isLoadingError` rather than `failedToLoad`, which stays true while a once-failed query reloads and would blank the previous query's results when the user goes back to it.

## Out of scope

`searchSaveSelected`, which both screens call when an item is chosen, records a recent search. Only `searchAll` with an empty query reads recent searches, and no screen issues that query, so the write touches no cache and stays a direct call with its existing lint waiver.

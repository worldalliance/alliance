## The hook

`useCitySearch` sits in `shared/forms/` beside `cityAutosuggest.ts`, its only caller, and owns `geoSearchCity` under `queryKeys.citySearch({ text, latitude, longitude })`. The key holds the text actually sent (before the first comma, trimmed), so "Paris" and "Paris, Fr" share one answer. Nothing writes city search results, so the hook is a read with no invalidation.

Its answers never go stale (`staleTime: Infinity`): the cities a text matches don't change, and the autosuggest applies each search's answer once, so a background refetch of a cached text would be a request whose answer is never shown. The app's `gcTime` still bounds how long they're kept.

It opts out of retries and runs whatever the network state, as `useSearchResults` does: the old search never retried and failed straight to an empty list, and backoff or an offline pause would leave the last suggestions up for seconds instead.

## The autosuggest

Debounce, minimum length and timing stay in `useCityAutosuggest`. Each settled debounce records a numbered search (the name and the location it was typed under). When that search's query settles, its results, `open: true` and `highlighted: -1` apply once, as each old response did; a text below `minLength` clears the results without a request. A search whose text's cached answer is a failure from before that search refetches and waits for the new answer, so a passing error doesn't leave every later search for that text ("Oslo", "Oslo, N") empty, as the old code's request on every debounce didn't. Keying the request by search text replaces the `AbortController`: a superseded search's response lands in its own cache entry and never reaches the shown results.

The results stay local state rather than reading the query's data directly, because they latch: the last answer stays up while the next search loads, and selecting a city clears them until the next answer.

Picking a city or committing a custom value drops the pending search, so a response arriving afterwards no longer reopens the list with the old suggestions, which the old code did.

A failed search empties the results, opens the list and logs "Geo search failed", as a server error did before; a network failure, which used to log and leave the previous suggestions up, now does the same. On mobile that reads "No matches"; showing a failure state is a separate change.

`fetchCitySuggestions` goes with its debug `console.log`s; nothing else called it. `fetchApproximateGeo` stays as it is: it calls a third-party URL, not the generated client.

## Tests

Bun's `jest.useRealTimers()` leaves the `clock` marker its fake timers put on `setTimeout`, and Testing Library's `waitFor` reads that as fake timers still running. The first `waitFor` test to run after `shared/forms/timeZoneSelect.test.ts` in the same process, the new `cityAutosuggest.test.ts`, then throws. The shared test preload restores real timers and drops the marker after each test, in its own commit, beside the spy and clipboard resets it already does.

The web `RenderField` tests that render every input kind now wrap in `queryWrapper()`, since the city field needs a query client.

# Decisions

## The race is in the test, not the hook

The test held each detail response for a fixed 100 ms and assumed the removal's refetch (load 3) would start inside that window. `waitFor` polls every 50 ms, so it can notice load 2 up to 50 ms late, and the removal's POST then has to finish within what is left. When it doesn't, load 2 lands first, `adding` settles on it, and `detailLoads` is 2. Delaying the removal handler by 120 ms reproduces exactly that failure (`Expected: 3, Received: 2`).

The hook is correct: TanStack Query 5.96 resolves a silently cancelled fetch with the promise of the fetch that replaced it (`query-core/src/query.ts`, the `error.silent` branch), so a tag change's `onSuccess: () => query.refetch()` settles once the replacing refetch lands.

## Every detail-delay test holds its responses instead

`detailDelay` is replaced by a `holdDetail` flag that parks each detail response on `pending()` from `shared/lib/testing/pending.ts`, the helper the shared normalization tests use. The two suspension tests and the deletion test used the same 100 ms window, so they move to holds too: the suspension-interrupted-by-a-tag-change test otherwise passes without the interruption ever happening, and the deletion test asserts the refetch is still in flight.

In the tag-change test only the replacing refetch (load 3) is released before `await adding`. A hook that settled on load 2 would never settle and the test would time out; one that settled on the cancellation would leave load 3 in flight, failing the `idle` assertion. The deletion test likewise waits for its held refetch to be queued before releasing it, instead of relying on `serveApi` queueing it before the mutation settles.

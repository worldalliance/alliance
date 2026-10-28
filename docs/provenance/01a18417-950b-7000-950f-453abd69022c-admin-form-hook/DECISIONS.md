## Owner

`adminTaskFormQuery` in `shared/lib/useTaskForm.ts` already defines the admin form-by-id query, and `useAdminTaskForm` and `useActionMergedResponsesAdmin` read through it. The code that went around it joins it there as `useAdminTaskFormActions`, beside the query it shares a cache with, rather than in a new module.

`useFormQuestionFields` (`shared/lib/useFormSchema.ts`) also calls `tasksGetFormAdmin`, but caches a different thing: the question fields parsed leniently out of the schema, under `formsAdminAll`, with its own stale time and failure states. It stays as it is; every form save already invalidates it.

## Fetching once

The form builder copies the stored form into its draft once per form, and the action dashboard's duplicate and the builder's conflict dialog each read it once. A rendering query would reload the draft over the admin's edits on every background refetch, so these go through `fetchLatest`, which sends a request of its own with the query's own fetch-and-error code and puts what it got in the cache the responses screens read. It isn't `queryClient.fetchQuery`: that joins a fetch of the same key already in flight, so the action dashboard's duplicate would wait on the reporting screen's older read and its retries; and cancelling that fetch first would also cancel an overlapping `fetchLatest`, such as the builder's load re-run by Retry, failing a read that was succeeding. Once its own read lands, `fetchLatest` cancels a screen's fetch still in flight before caching what it got, so the older read can't overwrite it. A screen fetch sent after its read is cancelled too, leaving the cache on the read `fetchLatest` made until the screen's next refetch; telling the two apart would need when each fetch started, which TanStack Query doesn't expose. It doesn't retry, as the direct calls didn't: an admin waits on each of these reads, and the Duplicate button stays clickable while one runs, so the app's default backoff would add seconds and widen the window for a second duplicate.

The builder keeps its own loading, error and retry state, since the load is an effect keyed on the form id, not a query it renders.

## Saving

`updateForm` is a mutation returning a `Result`, so the builder still tells a conflicting save (409) from a failed one and keeps its messages. A request that never reaches the server is `Failed` too, logged, so callers handle one contract rather than a `Result` and a rejection; the builder now says "Could not save form" for it rather than the browser's network error text. A successful save puts the returned form in the cache (the endpoint returns the form as the admin read serves it) and invalidates `formsAdminAll` without waiting on it, as the builder did before.

## Refresh

`useActionMergedResponsesAdmin`'s refresh refetched `queryKeys.taskForm`, the member's key, so a refresh never reloaded the forms the merged view shows. It refetches `queryKeys.taskFormAdmin` now, as `useFormResponsesAdmin` does. That fix lands first, on its own, so it can ship ahead of the rest.

The target names the code that calls the endpoints; the two refreshes touch the same cache by its raw key, so they join it too, under the requirement that everything touching a cache lives in one named hook. Both refreshes then reload their forms through the owner's `refetch`, which keeps `refetchQueries` semantics (only cached queries, rejecting on failure) so a failed refresh still fails the refresh mutation.

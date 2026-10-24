## The group

Of the page's four raw reads, only the tag summaries are touched by writes: the page's tag checkboxes post membership through `useTagsAdmin`, and the Tags page creates, renames and deletes tags through the same hook. Notifications, form submissions and friends have no write on this page, so they have no cache to share yet and stay in the loader with their lint disable.

## The hook

`useTagsAdmin` already owns the full tag list (`queryKeys.tagsAdmin()`) and every tag write, so the summaries join it under `queryKeys.tagSummariesAdmin()` rather than getting a hook of their own, which would leave the writes that change them in a different hook. Callers opt in with `summariesEnabled`; it defaults off so the existing callers don't start loading summaries they never read.

Creating, renaming and deleting a tag invalidate both the list and the summaries. Adding or removing a member invalidates only the list: a summary carries no members, and a membership change doesn't touch the tag row.

`useTagsAdmin` moves from `shared/lib` to `apps/admin/src/lib` in its own commit first. Only admin code uses it, and the summaries query needs `loaderPrefetchStaleTime` from the admin `QueryClient` module, which `shared` cannot import.

## The section

`UserTagsSection` reads the summaries from the hook instead of mirroring loader data into local state. Its patch of the toggled tag into that state goes: a membership write doesn't change a summary, and a rename elsewhere now reaches the section through invalidation. The section shows loading and failed-load states, per the root `AGENTS.md` rule to fail loudly, where a failed load used to read "No tags available," and says it could not refresh when a reload fails over tags it already shows, as the member and actions sections on the same page do.

## Loading

The loader prefetches the summaries through `prefetchFromLoader` without awaiting, as it does the member and the action relations. The page test's gate that proves the member fetch doesn't wait on the loader moves from the summaries route to the notifications route, which the loader still awaits.

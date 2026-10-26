## The hook

`useUserNotifsAndFormsAdmin` in `apps/admin/src/lib/` owns both reads, keyed by `queryKeys.userNotifsAdmin(userId)` and `queryKeys.userFormResponsesAdmin(userId)`. One hook covers both endpoints because the page shows them side by side and nothing else reads either. It stays apart from `useUserDetailAdmin`, which holds the member and the writes that change it; neither of these reads is touched by those writes, and `deleteAccount` already invalidates every query.

Each read is exported as `queryOptions` with `loaderPrefetchStaleTime`, as `userDetailQuery` and `userActionRelationsQuery` are, so the loader starts them through `prefetchFromLoader` and no longer awaits them. The page renders the member as soon as it loads instead of waiting on two unrelated lists.

## Failures

A failed load used to show an empty list: an HTTP error from either call left `data` undefined and the page fell back to `[]`, and the form call's `.catch` hid network errors too. Both sections now use the page's existing `SectionLoadState` ("Failed to load notifications", "Failed to load form submissions") and `SectionRefreshError` for a failed refetch over cached data, matching the friends, tags and actions sections, per the root `AGENTS.md` rule to fail loudly.

The hook is called once in `UserDetail`, which passes the notifications query to `UserNotificationsSection` and the form submissions query to `UserFormSubmissionsSection`, which moves out of the page with its markup unchanged so it can return early while loading, as the sibling sections do.

## Target

The home feed's cache key, `["useHomeFeed", ...]`, is private to `useHomeFeed.tsx`, but resetting it took a query client from the caller. The web home page read the client only for this reset; the mobile home screen, likewise.

## The hook

`useResetHomeFeed` in `useHomeFeed.tsx` returns a stable callback that resets every home feed query, as `resetHomeFeed` did. It is a companion to `useHomeFeed` rather than a field on its return: the web home page and `useTaskFormSubmission` reset the feed without rendering it, and calling `useHomeFeed` there would start its query. It follows `useInvalidateActions` in `shared/lib/actionsListPage.ts`.

`resetHomeFeed` and its structural `ResettableQueryClient` parameter type go. The structural type let callers pass their own package's `QueryClient`; the hook takes the client from `useQueryClient` in `shared`, as `useTaskFormSubmission` already does on both apps.

The web home page and mobile home screen drop `useQueryClient`, which they used only for the reset.

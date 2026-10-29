## The fix

Both hooks spread `openFormQueryOptions` from `shared/forms/openFormQueryOptions.ts`, so it sets `refetchOnWindowFocus: false` and `refetchOnReconnect: false` for both. `staleTime: Infinity` doesn't cover failures: TanStack counts a query that failed with no data as stale, so its default focus refetch reloaded it.

TanStack already defaults `refetchOnReconnect` to off for `networkMode: "always"`, so reconnect didn't reload either hook. It is set explicitly so an app default turning it on can't bring the reload back; the tests turn both on in the app defaults to pin each option.

## The guideline

It goes in the root `AGENTS.md` as "Failed loads": the hooks live in `shared/`, and only work under `apps/**` reads `apps/AGENTS.md`.

## Not yet decided

The apps' query defaults still retry on their own: `sharedweb/lib/queryClient.ts` retries up to three times and keeps TanStack's focus refetch; `apps/mobile/lib/queryClient.ts` retries up to two times. Whether to change them to match the guideline is the user's call; they are unchanged.

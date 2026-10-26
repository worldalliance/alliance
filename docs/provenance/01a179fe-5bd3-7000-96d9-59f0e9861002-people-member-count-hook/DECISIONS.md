## The hook

`useAllianceMemberCount` (`shared/lib/useAllianceMemberCount.ts`) already owns `userNmembers` under `queryKeys.allianceMemberCount()`, and four other frontend screens read the count through it. The People page joins them instead of getting a hook of its own. That leaves no direct `userNmembers` call outside the hook.

## Dropping the loader rather than seeding the cache from it

The page's `loader` is a server loader (`ssr: true`; `/people` isn't in `prerender`), so it runs on the frontend server, outside the browser's query cache. Seeding the cache from it would need dehydrate/hydrate plumbing the app doesn't have. The root `QueryClient` is also a module singleton, so a server-side seed would be shared across requests. The loader isn't used in `meta`, and the member grid and staff list on the same page already load on the client, so the loader's only gain was the count sentence in the server HTML. A client-side navigation to `/people` no longer waits on the count.

## Load failure

The count sentence stays hidden while the count loads and when the load fails, as it did when the loader returned `undefined`.

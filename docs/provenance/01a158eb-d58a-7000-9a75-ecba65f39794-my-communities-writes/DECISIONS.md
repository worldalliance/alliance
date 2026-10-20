## The hook

`useMyCommunities` gains `saveCommunity` (`communityUpdate`), a `useMutation` with `throwOnError` that puts the returned group in the cache, as the callers did before. The raw cache setter `updateCommunity` stays inside the hook and leaves its return value, so no caller patches the cache by hand.

It sets `networkMode: "always"`, as `createCommunity` does, so an offline save fails its form at once instead of pausing with "Saving…" up.

## Callers

Web `useCommunityEditor` and mobile `GroupSettingsTab` call `useMyCommunities()` themselves for the save; `useCommunityEditor` loses its `onUpdated` parameter.

## Error copy

A refused save reads through `thrownRefusalMessage`, as group creation does: a 4xx shows the server's message, a 5xx or a request that never reached the server shows the existing fallback, and a 401 shows `UPDATE_GROUP_SESSION_EXPIRED`, beside `CREATE_GROUP_SESSION_EXPIRED`.

## Out of scope

Admin's group pages write through `useCommunitiesAdmin`, its own cache.

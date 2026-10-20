## The hook

`useMyCommunities` gains `saveCommunity` (`communityUpdate`) and `deleteCommunity` (`communityDelete`), each a `useMutation` with `throwOnError`. The raw cache setters `updateCommunity` and `removeCommunity` stay inside the hook and leave its return value, so no caller patches the cache by hand.

- Saving puts the returned group in the cache, as the callers did before.
- Deleting drops the group and calls `refreshMemberships`, as leaving does: deleting is a change to the member's own groups, and a public group's disappearance alters the public list.
- Both set `networkMode: "always"`, as `createCommunity` does, so an offline write fails its form at once instead of pausing with "Saving…" up.

## Callers

Web `useCommunityEditor` and mobile `GroupSettingsTab` call `useMyCommunities()` themselves for the writes they need; `useCommunityEditor` loses its `onUpdated` parameter and its `onDeleted` loses its id, since `CommunityPage` only navigates away there now.

## Error copy

A refusal reads through `thrownRefusalMessage`, as group creation does: a 4xx shows the server's message, a 5xx or a request that never reached the server shows the existing fallback, and a 401 shows a sign-in-again message (`UPDATE_GROUP_SESSION_EXPIRED`, `DELETE_GROUP_SESSION_EXPIRED`, beside `CREATE_GROUP_SESSION_EXPIRED`).

## Out of scope

Mobile has no screen to delete a group; adding one is a feature, not this migration. Admin's group pages write through `useCommunitiesAdmin`, its own cache.

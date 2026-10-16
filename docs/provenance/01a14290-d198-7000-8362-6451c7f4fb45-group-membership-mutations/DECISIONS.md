## Owner hook

`useMyCommunities` owns the `myCommunities` cache, so leaving a group and joining a public one become mutations on it (`leaveCommunity`, `joinPublicCommunity`). It already holds every other write to that cache. A separate hook would mean a second place writing the same cache.

## Cache updates

Both mutations invalidate `myCommunities` and `publicCommunities` through `refreshMemberships`, which `useIncomingCommunityInvites`' accept shares. A public group's member count changes when a member joins or leaves it.

Leaving drops the group from the `myCommunities` cache at once and refreshes in the background. A leave whose refetch fails still shows the group gone.

Joining awaits the refetch and writes nothing to the cache itself. The server also removes the user from every group they don't lead, which the client can't reproduce without duplicating that rule. So the join confirmation waits for the list fetches, as the callers' manual refresh did before.

Mobile also refetched incoming invites after a join or leave. The server's join and leave don't touch invites, so the mutations don't refresh them.

## Signed-in user

The signed-in user lives in each app's `AuthContext`, outside react-query, so callers still call `refreshUser()` after a mutation, as they do with `useGroupAssignment`.

## Call sites

The sections call `useMyCommunities()` themselves rather than taking the mutation as a prop, so the `removeCommunity` and `refreshCommunities` props that only served the manual refresh are gone. Mobile's `MemberGroupsSection` keeps `refreshAll` because group assignment still uses it.

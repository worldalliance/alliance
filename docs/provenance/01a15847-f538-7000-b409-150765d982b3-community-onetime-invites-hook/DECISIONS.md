## The cache

The mobile invites tab reads a group's one-time invites through `useCommunityOnetimeInvites`, so the tab and web's leader invites tab share `queryKeys.communityOnetimeInvites(communityId)`, and every caller of `userOnetimeInviteGetOnetimeInvitesByCommunity` goes through the hook. Pull-to-refresh refetches it alongside the community invites.

## Writes

Mobile writes one-time invites only through `useOnetimeInvitesOverview`, and mobile caches queries for five minutes, so the tab would show a stale list after an invite was created or answered elsewhere, where before it refetched on every visit. `useOnetimeInviteCache` therefore invalidates the overview and every group's list other than the one it wrote into. That lands in its own commit before the tab moves onto the cache, and also keeps web's overview and leader tab in step.

## Failure

A failed load used to be logged and shown as no pending invites. The tab now shows the same `LoadFailed` it shows when the community invites fail, per the root `AGENTS.md` rule to fail loudly. Retry refetches whichever list failed.

The hook gains `didFail` (`failedToLoad`), as `useCommunityInvites` has, so the failure screen stays up while a retry is in flight rather than dropping back to the spinner.

## Out of scope

`communityUpdate` in the same file saves the group settings outside a named hook; it touches the communities cache, not this one.

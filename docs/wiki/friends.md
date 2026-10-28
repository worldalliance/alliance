# Friends

Members befriend each other by request: one sends, the other accepts or declines, and either side can later cancel or unfriend. Friendship is symmetric once accepted. Other features read it: messaging, the activity and home feeds, search, the comments Friends filter, the web members list's Friends of friends filter, signup social proof, reminder social proof, and [cluster assignment](../../server/src/cluster/cluster.algorithm.ts), which keeps friends out of the same cluster when an admin reassigns clusters.

## Relationship

A pair of members has at most one live `Friend` row, whichever of them sent the request. The row records the `requester`, the `addressee`, and a status: `pending`, `accepted`, or `declined`. `none` exists in the enum and is what the API reports when there is no row. Stored generated columns `lowUserId` and `highUserId` carry the pair in a fixed order under a unique index of live rows, and a check constraint rejects a member befriending themself ([entity](../../server/src/user/entities/friend.entity.ts#L27-L49)). The pair key and the "accepted and not deleted" rule live in [`friendship.ts`](../../server/src/user/friendship.ts); accepted-friend queries and the pair lookups for removal and status use them, while sending a request and listing pending requests query by direction, since the direction decides the outcome.

`GET /user/myfriendrelationship/:id` reports the status from the caller's side, with `didReceiveRequest` true when the caller is the addressee of a pending request ([`getRelationshipStatus`](../../server/src/user/friend.service.ts#L333-L348)). A declined row reports `declined` to both members.

## Sending a request

`POST /user/friends/:targetUserId` ([controller](../../server/src/user/user-friend.controller.ts#L35-L67), [`saveFriendRequest`](../../server/src/user/friend.service.ts#L91-L163)) refuses a request to oneself with 400 and one involving a deleted account with 404, then resolves by the pair's existing row:

- No row: a pending row is created and the addressee gets a "wants to be friends" notification.
- Already friends, in either direction: 409 "Already friends".
- The target already has a pending request to the caller: that request is accepted, exactly as if the caller had tapped Accept ([crossing requests](../provenance/01a0b704-2cbe-7000-9842-55b31661aaff-crossing-friend-request/DECISIONS.md)).
- The caller's own request is pending: nothing changes and no second notification is sent.
- The caller's request was declined: it returns to pending with a new notification ([resend](../provenance/01a0bb1a-4b71-7000-9b19-56bf8c5d7a00-friend-resend-notif/DECISIONS.md)).
- The caller had declined the target's request: the same row flips direction, becomes pending from the caller, and notifies the target.

The response is the caller's resulting status, the same body `myfriendrelationship` returns, so the client can tell "request sent" from "friends". PostHog records `FriendRequestAccepted` when the send accepted the other request and `FriendRequestSent` otherwise.

Two members sending each other a request at the same moment can both miss the other's row. The unique index rejects the second insert, and [`createFriendRequest`](../../server/src/user/friend.service.ts#L78-L89) retries once, which then finds the winning row and accepts it ([one row per pair](../provenance/01a0b6ef-68c7-7000-9c3b-bc25f3cbb87b-friend-pair-unique/DECISIONS.md)).

## Answering, cancelling, and unfriending

`PATCH /user/friends/:requesterId/accept` and `/decline` act only on a pending request addressed to the caller and answer 404 "No pending request found" otherwise ([`updateFriendRequestStatus`](../../server/src/user/friend.service.ts#L176-L229)). Both mark the request notification read. Accepting stamps `acceptedAt`, notifies the requester that their request was accepted, and emits `FriendsAccepted`. PostHog records `FriendRequestAccepted` for an accept, the same event a crossing send records; a decline records nothing.

`DELETE /user/friends/:targetUserId` cancels a pending request, removes a received one, or unfriends, from either side ([`removeFriend`](../../server/src/user/friend.service.ts#L244-L269)). It soft-deletes the row and marks both the request notification and the "accepted your friend request" notification read, so neither leaves an unread badge pointing at a relationship that no longer exists ([cancel](../provenance/01a0bb4f-dbaf-7000-98db-663e577b3cfd-cancel-friend-notif/DECISIONS.md), [unfriend](../provenance/01a0bb5a-2ac3-7000-9d1a-6ce724054400-unfriend-accepted-notif/DECISIONS.md)). A later request between the pair starts a new row. With no row it does nothing. PostHog records every call as `FriendRemoved`, including one that found no row.

## Automatic friendships

A member who signs up through another member's referral becomes their friend immediately, with no notifications ([`makeFriendsAutomated`](../../server/src/user/friend.service.ts#L283-L305), called from [signup](../../server/src/auth/auth.service.ts#L350-L355)). Git history dates this to `eb2861b14` ("referral codes + misc styling"); no provenance records the request for it.

## Messaging

Friends can message each other directly: a direct conversation between friends joins both members, where one between non-friends starts as a message request unless either member is an admin ([`conversation-creation.service.ts`](../../server/src/messaging/conversation-creation.service.ts#L100-L107)). When two members become friends, by accepting or automatically, a pending direct-message invite between them is accepted, so a new friend never appears as a message request ([`acceptDirectInviteBetween`](../../server/src/messaging/conversation-membership.service.ts#L121-L172)). Friends are among the users a member can message ([`findMessageableUsers`](../../server/src/user/user-directory.service.ts#L75-L129)).

## Member clients

Web and mobile share the [status](../../shared/lib/user.ts#L149-L165) and [list](../../shared/lib/user.ts#L238-L317) queries and the [mutations](../../shared/lib/user.ts#L325-L430) in `shared/lib/user.ts`. A mutation writes the status it knows into the cached friend status: the send's response, `accepted` after an accept, `none` after a decline or removal. It then refetches the request lists, plus the friend lists and messageable users after anything but a decline, and stays pending until they arrive, so a button disabled while pending stays disabled until the answered row leaves its list. A failed mutation refetches the status and lists and shows the server's refusal message, a sign-in-again message for an expired session, or a generic retry message for a network or server failure ([`friendMutationErrorMessage`](../../shared/lib/user.ts#L352-L357)).

Clients treat `declined` like `none` and offer to send again ([declined resend](../provenance/01a0b6f9-4ed4-7000-bbcf-5e6fb150bd67-declined-friend-resend/DECISIONS.md)).

| Status from the viewer's side | Web profile                                                                                                               | Mobile profile                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `none`, `declined`            | Send friend request                                                                                                       | Send friend request                                       |
| `pending`, sent               | "Friend request sent"; clicking sends again, which changes no row or notification but records another `FriendRequestSent` | "Friend request sent", disabled                           |
| `pending`, received           | Accept                                                                                                                    | Accept and Decline                                        |
| `accepted`                    | "Friends", turning into "Remove friend" on hover, with a confirmation                                                     | "Friends" menu with Remove friend, without a confirmation |

Web: [`FriendRequestButton`](../../apps/frontend/src/components/FriendRequestButton.tsx#L13-L75) on [`UserProfileCard`](../../apps/frontend/src/components/UserProfileCard.tsx#L272-L304), which also shows a message button to friends when messaging is enabled. Mobile: [`FriendRequestButton`](../../apps/mobile/components/member/FriendRequestButton.tsx#L17-L184).

A profile's friends list is visible to any signed-in member (`GET /user/listfriends/:id`), and so is every member's list of friend IDs at once ([`GET /user/membersWithFriends`](../../server/src/user/user.controller.ts#L289-L309)), which web's [members list](../../apps/frontend/src/pages/app/MembersListPage.tsx) uses for its Friends of friends filter. On one's own profile the list adds received and sent requests: web's [`FriendsTab`](../../apps/frontend/src/components/FriendsTab.tsx) shows Friends, Received Requests, and Sent Requests tabs with counts, where friends can be removed on hover, received requests accepted or declined, and sent requests cancelled. Mobile's [`useFriendsList`](../../apps/mobile/components/member/useFriendsList.tsx#L95-L253) has the same three tabs, without counts or removing a friend from the list (mobile removes one only from the profile's Friends menu), and adds a message button on each messageable friend and a confirmation before cancelling a sent request. On web, opening a friend-request or accepted notification opens the other member's profile on its Friends tab, showing their friends; a received request is answered from the profile's Accept button ([`useNotificationActions`](../../apps/frontend/src/lib/useNotificationActions.ts#L47-L50)).

A friend status or list that fails with no data to show is a failure, not an empty state: the profile shows a refresh icon where the friend button goes, and a failed list replaces its empty text with "Couldn't load this list." and Try again. On web, a failed list's tab label and the profile's friend count drop the number instead of showing 0. A failed refetch over data already shown keeps the data. That rule is shared with other surfaces, through [`failedToLoad`](../../shared/lib/failedToLoad.ts); its record is [friend query error states](../provenance/01a0bb79-a555-7000-9f77-1d848787d1f5-friend-query-error-states/DECISIONS.md).

## Admin

The Friend Graph page (`/friend-graph`, under Community in the [sidebar](../../apps/admin/src/components/SidebarNav.tsx#L181-L201)) draws accepted friendships between members who both have an active contract; the server applies that restriction ([`findFriendGraphEdges`](../../server/src/user/friend.service.ts#L350-L359)) and the page draws only those members as nodes. It keeps the invite graph's role, community, and tag filters. Clicking a member highlights them and their direct friends in blue without hiding anyone, and a Spread slider sets how far nodes repel ([`FriendGraphPage`](../../apps/admin/src/pages/FriendGraphPage.tsx); [record](../provenance/01a0b180-775d-7000-9447-481c53a03e39-friend-graph-admin/REQUIREMENTS.md)).

The admin member page lists the member's friends with their contract, ambassador, and leader labels, showing loading and failure states of its own ([`UserFriendsSection`](../../apps/admin/src/components/user-detail/UserFriendsSection.tsx); [record](../provenance/01a17931-c459-7000-b969-0bb89c5abe4b-user-friends-hook/DECISIONS.md)).

## Tests

- Server request lifecycle, notifications, crossing and racing requests, and self-requests: [`users.e2e-spec.ts`](../../server/test/users.e2e-spec.ts#L640-L1031). Friend graph edges and admin-only access: [same file](../../server/test/users.e2e-spec.ts#L3848-L3922). Pair key and `friendOf`: [`friendship.spec.ts`](../../server/src/user/friendship.spec.ts).
- Friendship read from either side, messaging, and signup social proof: [`friendship.e2e-spec.ts`](../../server/test/friendship.e2e-spec.ts). Referral auto-friendship: [`auth.bearer.e2e-spec.ts`](../../server/test/auth.bearer.e2e-spec.ts#L500). Deleted accounts and requests after a removal: [`soft-delete-lifecycle.e2e-spec.ts`](../../server/test/soft-delete-lifecycle.e2e-spec.ts#L101-L194). A request to an account deleted after it loads: [`parent-lock-writers.e2e-spec.ts`](../../server/test/parent-lock-writers.e2e-spec.ts#L50-L75). A request deleted while its addressee accepts: [`live-row-updates.e2e-spec.ts`](../../server/test/live-row-updates.e2e-spec.ts#L133-L158).
- Web: [`FriendRequestButton.test.tsx`](../../apps/frontend/src/components/FriendRequestButton.test.tsx), [`FriendsTab.test.tsx`](../../apps/frontend/src/components/FriendsTab.test.tsx), and the friend status cases in `UserProfilePage.test.tsx` ([load and refusal](../../apps/frontend/src/pages/app/UserProfilePage.test.tsx#L123-L150), [failures](../../apps/frontend/src/pages/app/UserProfilePage.test.tsx#L176-L231)), and the friend-request case in [`useNotificationActions.test.tsx`](../../apps/frontend/src/lib/useNotificationActions.test.tsx#L72-L85). Admin: [`FriendGraphPage.test.tsx`](../../apps/admin/src/pages/FriendGraphPage.test.tsx) and [`useFriendGraphEdgesAdmin.test.ts`](../../apps/admin/src/lib/useFriendGraphEdgesAdmin.test.ts), and the friends cases in [`UserDetailView.test.tsx`](../../apps/admin/src/pages/UserDetailView.test.tsx#L430-L461).
- Shared mutations and their cache updates: [`user.test.ts`](../../shared/lib/user.test.ts).
- Untested: the mobile friend button and lists, since mobile has no component tests; the web hover-to-remove and its confirmation.

# Group join notification specification

Current agent decisions and implementation rationale for [REQUIREMENTS.md](./REQUIREMENTS.md).

## Event and audience

Treat a successful transition from absent to present in a group's membership as the event. Invitation creation, waiting for assignment, signing an agreement without entering a group, role changes for an existing member, and repeated attempts to add an existing member produce no new event.

Every join path except two goes through `CommunityService.addUsersToCommunityAndRefreshConversation`: public join, invitation acceptance, all three contract-signing placements (invite, referral, reinstatement), and the batch assignment's per-member add. That method emits the event, so each of those callers gets it without its own hook. The two paths that write membership elsewhere hook in separately: the staff add/move (`placeUserInCommunityAdmin`, a post-commit effect beside its existing notifications) and `addLeaderAdmin` when it makes a non-member a leader. The second is still a staff placement that adds a member, so it counts.

Capture the union of existing members and leaders before the addition, deduplicated by user ID. Exclude the incoming member. Each existing recipient receives a separate new notification for each successful addition; a later, independent join sees the updated membership.

For a batch assignment, each destination group's audience is fixed before the loop: its pre-batch members and leaders, minus every batch member who doesn't lead it. Batch members leave every group they don't lead before joining their destination, so excluding them all keeps the result independent of loop order. That covers both a newcomer to the group and a member who is moving out of it.

Emit the new notification only after membership is persisted successfully. New-notification work must not change the success or failure of the existing join flow: `GroupJoinNotifsService.notify` never rejects, and it runs off the membership write rather than after the legacy notification save, so a legacy failure does not suppress it. A persisted join with no audience needs no notification rows. A departure followed by a successful rejoin is a distinct event.

## Coexistence and data

Introduce a distinct notification category for this feature. Reusing the existing `MemberJoinedCommunity` category would apply the new preference to legacy leader messages, violating the requirement to preserve their behavior. Keep the existing category and all its producers intact.

A leader, inviter, or referrer may receive an existing message and this new message for the same join. That overlap is intentional. The new toggles affect only the new category, so disabling them can still leave an existing group push enabled.

The category is `GroupMemberJoined` (`group_member_joined`). The preferences are `pushesForNewGroupMembers` (default true) and `textsForNewGroupMembers` (default false), non-null columns whose defaults cover both migrated and future accounts. The new category goes in the database enum and the exhaustive category mappings, with the same priority as existing member-joined notifications. Existing notification rows and existing preferences retain their values.

Reuse the notification entity's recipient, associated joining member, timestamp, and referenced group destination. Keep referenced member/group labels so rendering follows the established handling of renames and deleted references. Use the full-name reference for the member. The copy and destination are specified in REQUIREMENTS; no new template editor or experiment configuration is needed.

## Settings and delivery

Show “New group members” with Push and Text/SMS controls in the member notification settings on both web and mobile. Members edit their own account preferences through the existing profile authorization and save/error behavior. The controls apply across all their groups and remain available when they currently belong to none. Group leaders gain no control over another member's settings; no admin configuration screen is added.

Create the in-app entry for every event recipient regardless of channel settings or the overall outbound opt-out. Attempt each outbound channel independently:

| Channel | Eligibility                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Push    | New push preference enabled, overall notification opt-out unset, and a registered usable device. Check the preference in the dispatcher.                                 |
| SMS     | New SMS preference enabled, overall notification opt-out unset, canonical valid phone number present, and phone number not unsubscribed. Check when attempting the send. |

An active agreement is not an additional recipient requirement: paused leaders are explicitly included. The existing action-SMS eligibility helper also requires an active agreement and the action-reminder toggle, so using it unchanged would violate the required audience and independent settings.

Both eligible channels may deliver for the same event. Missing devices or an unusable/unsubscribed phone suppress only the affected channel. There is no email channel or cross-channel fallback. Enabling a setting later does not replay earlier events.

Persist the in-app entry and make push eligible immediately after the successful join; ordinary dispatcher latency and existing read-before-push suppression apply. Attempt SMS through the existing sending service with the group's Members link at the end. Each text is tracked like other SMS: a `group_join` message source, with the in-app notification's ID in its context. Sends run in parallel and are awaited inside the join request, the same way forum-reply texts are. Group size is capped, and the sending service's own timeout bounds the wait.

SMS eligibility shares the phone-usability rule (overall opt-out unset, canonical number, not unsubscribed) with the action-SMS helper through a common function in `user.utils.ts`. The action helper's active-agreement and toggle checks stay out of it.

Web navigation already honors `/groups?tab=members&communityId=…`. On mobile, the groups screen reads those params, applies them once the user's groups load, then clears them so the same link works again. Push and in-app taps on both platforms route through that path.

## Delivery edge cases

**Departure before delivery:** use the captured event audience and existing reference rendering. Add no membership recheck, cancellation, or cleanup when the recipient or joining member subsequently leaves. An already-created entry can remain and a pending message can still send; link access follows existing group access rules. This avoids extra membership queries and cancellation logic.

**Delivery failure:** keep successful membership changes and any saved notification entries. Reuse existing push dispatch, provider status recording, and SMS error reporting. Log new-notification persistence or send failures and continue other recipients/channels where possible. Add no retry queue, delivery reconciliation, or exactly-once delivery system. Provider acceptance does not guarantee delivery, and a failed new notification can be missed. These limits keep delivery within the existing infrastructure.

## Acceptance checks for implementation

1. Exercise every join path in the trigger requirement. Each successful addition creates one new in-app entry per unique pre-existing recipient with the specified copy and destination. Cover a paused leader, a leader who is also in the members list, and the joining member's exclusion.
2. Verify the batch audience using two additions to the same group; neither newcomer receives the other's notification from that batch. Verify a later independent join does notify those members. Group creation and attempts without a membership addition create none.
3. Verify a leave/rejoin creates another event. Existing leader, invitation, referral, assignment, and removal notification behavior remains unchanged alongside the new notification.
4. Exercise the independent preference combinations, overall outbound opt-out, SMS unsubscribe, invalid/missing phone, missing device, and a paused leader. In-app remains available; action-reminder preferences have no effect on the new category. Confirm changing the new preferences does not alter legacy notifications.
5. Verify migrated/new-account defaults, saving both settings on web/mobile, shared account state across clients, and existing save-error feedback. Disabling push before dispatch is honored; enabling a channel does not replay past joins.
6. Verify web/mobile navigation to the Members tab and exact SMS suffix. Existing rename/deleted-reference behavior applies, with no added membership cancellation after a departure.
7. Inject failure in new notification persistence and outbound sending. A successful membership change survives, saved entries remain, and existing notification behavior is unaffected. Verify no feature-specific retries or historical sends occur.

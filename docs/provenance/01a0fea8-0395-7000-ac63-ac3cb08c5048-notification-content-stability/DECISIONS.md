# Notification content stability: decisions

This document records agent-authored design and implementation choices behind the approvals in REQUIREMENTS.md. The implementation lives in `server/src/notifs/` (`notification-content.ts`, `notification-references.service.ts`, `notification-render.service.ts`, `reminder-message.ts`) and its callers. `server/test/notification-content.e2e-spec.ts` and `server/src/notifs/notification-content.spec.ts` cover the acceptance checks below.

## Message contract

Separate immutable event data and saved wording from explicitly referenced current labels. Pin the event type, occurrence time, participant identities, and involved object identities. Resolve display names when rendering, including for read entries. Avatars already come from the live `associatedUsers` join. A group rename changes its label; a member joining another group does not redirect an earlier departure event to the new group.

A new row stores its message as segments: literal strings, plus references to a member, group, action, or list of actions. A member reference records which name form the creating code showed: full name, public display name (anonymous members show as "Someone"), first name, or last name. Each call site keeps the form it used before, so a rename is the only visible change. Call sites build messages with the `notifMessage` tagged template: `member()`, `group()`, and `action()` interpolations become references, and every other interpolation becomes fixed wording. Saved prose is never searched for names.

Preserve all system-authored message wording, including notification-specific prefixes, once the entry reaches the member's inbox. Cosmetic edits use the same rule as substantive edits. Navigation controls and relative timestamp formatting remain presentation concerns. Clickability does not decide whether text is historical.

Action-update short notification text becomes a delivery snapshot. A later edit to the update changes the destination content and subsequent notifications, not a delivered entry's copy. Text written literally by staff, including a person's name, stays literal. Action-update copy has no reference syntax; adding one is outside this change.

Reply excerpts remain derived from the latest comment body. Their surrounding wording (`{author}: `) is stored with the row, the author is a reference, and editing the comment updates its preview even for a read entry.

Values that convey historical information keep their delivery-time value: a quoted deadline, past role, a reminder's task count, or an ambassador goal's tally does not update to today's state. Free text a member typed (a one-time invitee's name) stays literal. Object names used to identify the same user, group, or action remain current. This policy does not change the action's actual deadline or participation rules.

Missed-suite reminders are the one in-app message built from staff templates. Its `#{fullname}`, `#{firstname}`, `#{lastname}`, `#{action}`, `#{tasknames}`, and `#{formattedtasklist}` keywords become references. Every other keyword (counts, time remaining, links, plural switches) is filled at send time, as email and SMS do. The template renders in one pass with the references held in place, so a plural switch that wraps a referenced keyword still resolves. The task list keeps the set of tasks it named and shows their current names.

A row that references a deleted action is hidden. It is about that action, and no approved label exists for one.

## Availability and grouping

Wording becomes final once an entry reaches its recipient: the first time it renders for them, in the inbox list, the unread count, or a push, or when an edit or unpublish comes while they can see it. An entry that never rendered and that its recipient can't see when an edit lands follows that edit; no member has seen its text, so no displayed text changes. Reading it does not choose the wording. Future entries stay editable until that boundary.

Only action-update rows have editable source copy. Their freeze works as follows:

- **Creation.** Every row stores a live marker for the update's text when it is created, whether it is due immediately or scheduled. Its send time is the later of the update's date and the time it becomes visible, so no row comes due while its update is hidden. `notifyActionUpdate` refuses to send while the action is archived or would still be a draft when the entries arrive (their send time, or now once that has passed), judged by `actionStatusAt`, the rule behind `Action.status`, with an event dated at that moment counted as in effect, so no row comes due while its action is still a draft. The check runs again on the update as read under the claim's row lock, with the action row share-locked before the claim, so an archive waits until the sends commit and a delete of the action, which locks the action before its updates, waits instead of deadlocking. An archived action gets its own refusal, which tells the admin to unarchive it. It reads the update under its claim's row lock, so an unpublish that commits first sets the send time.
- **Freezing on render.** `NotificationRenderService.renderUnreadContents` decides which entries show, for the inbox, the unread count, and push alike. When it renders a referenced entry still holding the marker, it writes the text it showed into the row, only where the row still holds the marker. An entry a member saw therefore keeps that text even if they later lose access to the action and an edit lands meanwhile.
- **Freezing on edit.** `updateActionUpdate` calls `freezeActionUpdateCopy` before the transaction that writes new text, and `unpublishActionUpdateUntilDate` does the same before hiding the update. The freeze renders on its own pool connections, so running it inside the transaction would let concurrent edits exhaust the pool. It renders the update's due entries still holding the marker, from committed state, so every one its recipient can see takes the outgoing text through the render freeze above. Entries of an unpublished update, or of an action their recipient can't see, don't render and keep following edits. Retries, list loads, and push dispatch all read the same stored copy.
- **Immediate delivery.** `notifyActionUpdate` inserts its rows while its claim holds the update's row lock. An edit that commits first is the text at send. An edit that comes after freezes the rows already committed with the text they were sent with.
- **Remaining gap.** A row that comes due or is sent between the freeze and the edit's commit, and doesn't render in between, picks up the edit. No member has seen its text, so no displayed text changes. Closing it would take a scheduled finalizer, which this change does not add.

For likes, preserve the existing grouping boundary and unlike behavior. An unread record can change its participant set and count, and disappear when its last like is removed. Once read, later likes use a new unread record and unlikes leave the read record alone. A new group stores its singular wording (`{participant} liked your …`) and plural wording (`{count} people liked your …`) together, so a count change selects the matching phrase without adopting later code changes. The participant resolves to the group's sole remaining liker. The target label (`post: <title>`) is pinned at creation, except that a liked activity references its action, so the action's current name shows. A target excerpt that arrives later still fills the `targetContent` column but no longer changes the pinned wording.

Like aggregation is the specific exception allowing delivered event membership/count to evolve until read. Reminder counts and other historical values do not inherit that exception. Preserve the existing like-target excerpt behavior rather than introducing a new live post/comment preview in that category.

## Missing content and delivery

Suppress referenced-format content notifications whose target is deleted or inaccessible to the recipient, including their excerpt, navigation, and contribution to the unread count. A saved message does not authorize continued access to its source. Availability rules:

- **Post:** not soft-deleted, and visible to the recipient by the forum's rule: published, or scheduled and the recipient is an author, co-author, or admin. The forum and notifications both apply `filterVisiblePosts` (`server/src/forum/post-visibility.ts`).
- **Comment:** not soft-deleted, has a body, and its parent is available. The parent is a post, a visible action, or an available activity.
- **Activity:** exists and its action is visible to the recipient.
- **Action update:** exists, is published, and its action is visible to the recipient.

Action visibility is `ActionVisibilityService.userCanOpenAction`, the rule behind the action's page: a public-only action opens for anyone, and any other action follows `userCanSeeAction`, the check the action feeds use. It is batched by `openableActionIdsForUsers` so each action, recipient, and saved cohort decision loads once per render. A cohort action still evaluates its live cohort for each recipient no saved decision admits, only for recipients whose own rows are about that action, and one recipient at a time so a push batch doesn't queue hundreds of queries on the shared pool. The service lives in `ActionVisibilityModule` with its cohort dependencies, which NotifsModule imports directly. ActionsModule imports NotifsModule, so importing ActionsModule from NotifsModule would close a file import cycle that fails at load. Legacy rows keep their existing checks. Legacy unread-content rows render through the same path from content derived from their type, which reproduces their wording. An action's status, post scheduling, and update publication are judged at the database's clock, read once per render, because that clock also decides when a row comes due; a server clock running behind would otherwise hide a row due the moment its action launches and drop its push. Live cohort membership still reads the server's clock.

Membership events stay visible when their references disappear. A deleted member renders as "Deleted member" and a deleted group as "Deleted group". A row records which entity its location opens (`destination`). When that entity is gone, the response returns an empty `webAppLocation` and a null `mobileAppLocation`. Web then stays on the current page and mobile skips navigation, so no broken link is offered.

The inbox list, the unread count, and push dispatch all render through `NotificationRenderService`, so web, mobile, and new pushes agree. The unread count now loads unread referenced notifications to apply the same filter; legacy notifications are still counted by query, and unread-content rows were already rendered to count. Push dispatch renders a claimed batch once, with access checked per recipient. A row that doesn't render when it comes due is marked not to push, so the dropped push is recorded rather than left as a stuck claim. Unpublishing an update until a date reads that date under the update's row lock and moves its entries not yet due to it, so they arrive and push when the update shows; publishing it early leaves them at that date. Entries already due were delivered and stay put. Legacy entries move too: asked whether pre-rollout schedules should stay fixed, the user chose whichever was simpler in code, since no action updates will be scheduled across the rollout. An already delivered push is not resent or changed. Email and SMS are unchanged.

Current labels become visible on a normal notification refresh. Immediate propagation to an already open list is outside this change. Staff continue using existing authoring controls; there is no new history-editing or correction interface.

## Data and compatibility

`notification` and `unread_content` gain a `format` enum (`legacy` | `referenced`) and a nullable jsonb `content`, validated by `notificationContentSchema` on every read. The column defaults to `legacy`, which backfills existing rows and covers inserts from server code that predates the column, so a deploy's overlap window or a rollback past the migration keeps writing notifications. `createNotif` and `createUnreadContent` always write `referenced`. The renderer chooses the path by the row's marker, not its timestamps or a global switch. A legacy scheduled record delivered later remains legacy. An existing legacy like group keeps its format, and it keeps rebuilding its message with the legacy builder when it gains or loses likes.

Content carries the wording segments, an optional plural variant for like groups, an optional `destination`, and an optional `target` for like groups. Unread-content rows derive their target from `contentType`/`contentId`. Roles live in segment positions: "X removed Y from your group (G)" stores two member references and a group reference in order. Identities come from the creating operation, never from rendered text.

`notification.message` stays NOT NULL. On referenced rows it holds the text as of the last write; reads render `content` instead. The response shape is unchanged: `message` is the rendered string beside the current `associatedUsers` profiles, so installed web and mobile clients need no update and the generated API client does not change.

The schema change enables new snapshots and references; it does not rewrite existing rows. In particular, do not snapshot today's action-update text into old unread-content records, infer old actors, or rewrite old embedded names. The user owns any later manual conversion. New records created for older source content still follow the new rules.

## Acceptance checks

Where each check is covered (`e2e` is `server/test/notification-content.e2e-spec.ts`):

1. A new entry shows the current name around its original wording, before and after it is read. Covered by the e2e "names the current member and group" test and by unit tests for each name form.
2. A departure from group A shows A's current name, and joining group B does not redirect it. Covered by the e2e "names the current member and group" test.
3. Edits before availability flow into the entry; after availability its copy holds. Covered for both immediate and scheduled delivery by the e2e action-update tests.
4. A reminder keeps the deadline it communicated: time-remaining keywords are filled at send time and stored as literal text. The `buildReminderMessage` unit test covers send-time filling of non-reference keywords.
5. A reply shows its current excerpt and author inside its pinned wording, including after it is read. Covered by the e2e reply test.
6. Like groups follow the existing aggregation rules, with phrases taken from the pinned variants. Covered by the e2e like-group tests, including removal of the last like and a read group staying unchanged.
7. Deleted posts and action updates, and actions the member can no longer see, hide their entries and their unread counts. Deleted members and groups render with the generic labels and no link. Covered by the e2e tests.
8. A name written into the copy stays literal. Covered by the e2e "keeps a name written into the copy" test.
9. Legacy rows keep their baseline behavior. Covered by the existing `notifs.e2e-spec.ts` and `notif-push-dispatcher.e2e-spec.ts` fixtures, now marked `legacy`, and by the e2e legacy like-group test.
10. A push renders with the current name. Covered by the `notif-push-dispatcher.e2e-spec.ts` referenced-push test.

## Research basis

- [Knock's feed API](https://docs.knock.app/in-app-ui/api-overview) returns rendered blocks, the generating template, and workflow version metadata. It supports treating delivered content separately from later authoring changes.
- [Stream's enrichment example](https://getstream.io/activity-feeds/docs/javascript/v2/enrichment/) demonstrates updating referenced content in existing feeds; its [user model](https://getstream.io/docs/platform/users/) makes profile updates relevant across feeds. This supports resolving identity labels from references.
- [Mastodon's notification entity](https://docs.joinmastodon.org/entities/Notification/) separates event type/time, account, and target status. This provides a concrete example of event identity distinct from the rendered sentence.

These sources demonstrate available engineering patterns, not measured member confusion from cosmetic edits. The agreed policy combines stable communicated copy with current explicit labels rather than claiming a universal industry rule.

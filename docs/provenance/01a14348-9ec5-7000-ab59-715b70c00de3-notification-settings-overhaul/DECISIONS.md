# Notification settings overhaul

Current agent decisions and implementation rationale for [REQUIREMENTS.md](./REQUIREMENTS.md).

## Kinds and policy

A `NotificationKind` enum, separate from `NotificationCategory`, names every kind. `NotificationCategory` can't serve: messages, suspension notices, and action reminders don't travel through it, and friend requests and accepted friend requests share a column today. Exhaustive `Record` mappings tie each `NotificationCategory`, `UnreadContentType`, and `ReminderCohortType` to its kind, so a new producer fails the build until it is classified. Reminder sends map through their reminder group: a missed-suite group is "Missed deadline", the `GroupLeadsWithUncompleted` cohort is "Group members with uncompleted tasks", and every other cohort is "Action reminders". `ActionEventNotifType` gets no mapping: only `Reminder` and `MissedDeadline` rows are written, and the group decides those. An approved community invite request gets its own category, `community_invite_request_approved`, instead of sharing `community_invite_created` with the invite it creates, so the two can be different kinds. Ambassador recruiting-goal notices likewise get `ambassador_invite_goal` instead of sharing `new_member_referred` with "X joined the Alliance".

One `Record<NotificationKind, KindPolicy>` declares each kind's offered channels, whether it is required, whether it is leader-only, whether anything sends it, its section, and its label. Offered channels follow from the sending code, so the settings screens, the resolver, and the API validation all read this one table.

Nothing sends "New action announced" yet. An announcement is an ordinary reminder group with the announcement preset's copy, and no field tells it apart from a reminder, so it resolves as "Action reminders". Its policy marks it unsent, which leaves it out of the settings response and rejects its cells, so no screen offers a control that changes nothing. A follow-up adds an admin-set announcement flag on reminder groups, sends flagged groups as this kind, and marks it sent.

## Resolving a send

One server function decides whether a member wants a kind on a channel:

```text
channel offered by the kind
  AND (required ? channelDefault : override ?? channelDefault)
```

Reachability stays outside it: each sender keeps its current checks (active agreement, phone and SMS STOP, devices, `post.notifyForReplies`) and calls the resolver for the preference alone. Group join SMS has no active-agreement check today and gains none. A reminder's channels come from `externalChannels`, which the worker, the social-proof experiment, and the admin preview share, as does action update delivery. The group-lead cohort no longer drops leaders by preference: like every other cohort, a leader who wants none of the kind's channels gets an unsent row, so preference is decided in one place, at delivery. The `userActionNotifsEnabled_*` and `notificationPushesEnabled` helpers in `server/src/user/user.utils.ts` are replaced by the resolver plus the reachability checks they mix in today.

Contract suspension notices drop the active-agreement check. Today they pass it only because the worker checks a member loaded before the suspension committed; reloading the member would silently stop every suspension notice.

`NotificationPreferencesService.load` reads the recipients' channel defaults and their overrides for the kinds at hand in two queries, and senders resolve each recipient in memory. It loads defaults itself rather than reading them off a caller's `User`, so a sender holding a member loaded earlier, or only an ID, still resolves against current settings, and a deleted account resolves to nothing. No sender filters recipients by preference in SQL.

## Storage

- `user` gains `inAppByDefault`, `pushByDefault`, `textByDefault`, and `emailByDefault`, all `NOT NULL DEFAULT true`, which gives new accounts the all-On start. The migration copies the last three from `pushNotifsForActions`, `textNotifsForActions`, and `emailNotifsForActions`, which are retired with the other old columns instead of renamed: the release a deploy replaces still selects them by name.
- `notification_preference (userId, kind, channel, enabled, source)`, primary key `(userId, kind, channel)`, `ON DELETE CASCADE` from `user`. `kind` and `channel` are Postgres enums. `source` is `member` or `migrated` and feeds the admin page's labels.
- A table over a JSONB document: each cell is upserted or deleted on its own row, so two screens saving at once never overwrite each other's cells, and SQL recipient filters join it directly.

## Migration

Defaults copy from the three general toggles; in-app starts On for everyone. For every kind × offered channel, the migration computes the member's current effective delivery from today's gating and writes an override wherever it differs from the new default. The old per-kind settings feed that computation:

| Old setting                          | Kind and channels                                            |
| ------------------------------------ | ------------------------------------------------------------ |
| `pushesForActionUpdates`             | Action updates · push                                        |
| `pushesForLikes`                     | Likes · push                                                 |
| `pushesForComments`                  | Comments and replies · push                                  |
| `receiveReplyNotifications`          | Comments and replies · SMS, email                            |
| `pushesForFriendRequests`            | Friend requests · push; accepted friend requests · push      |
| `pushesForMessages`                  | Messages · push                                              |
| `pushesForNewGroupMembers`           | Someone joined your group · push                             |
| `textsForNewGroupMembers`            | Someone joined your group · SMS                              |
| `remindAboutUncompletedGroupMembers` | Group members with uncompleted tasks · every offered channel |

Kinds whose current gating ignores a general toggle get an On override wherever the member's default for that channel is Off. Overrides on leader-only kinds are written for every member, leader or not, so an opt-out survives becoming a leader. The core retires every column the migration read, plus `socialNotifsPreference` and `turnedOffAllNotifs`, and a PR deployed after it drops them with `forumDigestPreference` (see Retiring a column). `UserDto` drops the three action toggles, every per-kind field, and `turnedOffAllNotifs`, and carries no channel default: the admin page reads those from the admin view. The old `NotificationPreference` enum goes with `socialNotifsPreference`, whose retired field lists the enum's values inline. Overrides it writes have `source = migrated`.

## In-app visibility

The `Notification` or `UnreadContent` row is still written for every recipient, because push dispatch, link tracking, and action update delivery read it. `NotifsService` sets a `visible` flag on each row it writes from the recipient's in-app preference for the row's kind, and the inbox list and unread count read only visible rows. Push and action update delivery ignore the flag: action update delivery keeps requiring a renderable entry for access, and each other channel answers to its own preference. A like joins an unread like entry only when that entry's visibility matches the owner's current in-app preference, and otherwise starts a new one, so a change of setting neither hides an entry already shown nor reveals one already hidden. An entry scheduled to arrive later, such as an action update entry waiting on its date, has not been shown yet, so a change to the member's in-app settings recomputes `visible` on their unread content whose `sendTime` is still ahead. A fan-out still writing when the setting changes can save entries computed from the previous setting just after the recompute; that window of a few seconds is accepted (user-approved) rather than serializing fan-outs against settings saves.

## API

Dedicated endpoints replace the notification fields on `UpdateProfileDto`. They sit under `/user`, beside the profile endpoints, and take the session's member:

- `GET /user/notification-settings` returns the four defaults and, per kind the member can see, its label, section, whether it is required, and per offered channel the override (or `null`), the effective value, and whether the cell is editable. Leader-only kinds are left out for members who lead no group. Channel reachability is reported separately: whether a valid phone number is on file, and whether it replied STOP. Email needs no flag, since every account has one.
- `PATCH /user/notification-settings` takes defaults and cells, applies them in one transaction, and returns the settings as `GET` does. A boolean override upserts the cell with `source = member`, `null` deletes it, and an omitted field is unchanged. A cell on a required kind, an unoffered channel, or a leader-only kind from a member who leads no group, or a cell listed twice, is rejected with a 400 that saves nothing, as is a `null` default.

Push permission on the device is client-side state, so each app reads it locally for the blocked-channel notice.

## Example text

Each kind renders one example through the producer's own copy function with fixed sample input (`Maya Rowan`, `Jordan Ellis`, `Climate Hawks`, a sample action two days from its deadline). `KIND_EXAMPLE` in `notification-examples.ts` is a `Record<NotificationKind, …>` beside the kind policy rather than a policy field: it imports the senders' copy, and the senders import the policy. The server returns the rendered examples with the settings, so web and mobile show identical text that changes whenever the real copy does.

- One example per kind, in its most common wording, as it reads in-app or in push; a kind sent only by text or email would show that channel's text. Where a kind has several wordings, the copy for the one shown lives in `notifs/notif-copy.ts`, and the senders of that wording call it; other wordings stay where they are sent. (user-approved)
- Admins write each action kind's copy per reminder group, so its example renders the admin preset that group starts from, through the same `processKeywordReplacements` the reminder worker uses. The presets live in `@alliance/common/reminderPresetCopy`, shared by the server and the admin form. (user-approved)
- Messages and comments carry text members write, so their examples use sample text.

## Contract reminder

`user.contractReminderSentAt timestamptz NULL`, set just before the send, so no failed write can mail an account twice. Only a `MailNotSentError`, a failure before any mail row exists, clears it again for the next run to retry, matching the old rule that any `contract_reminder` mail row counted. The hourly worker selects accounts at least 24 hours old with no contract events and a null `contractReminderSentAt`. The backfill sets it on every account whose current email matches a past `contract_reminder` mail, using that mail's send time. `mail` records only the recipient address, so the current email is the only link to an account; members can't change their email in the app. The backfill runs once: the per-account rule reached production well before the core, so no release still sends by the old rule, and a rerun would only mark never-reminded accounts that share an email with a reminded one, such as a re-registration after a soft delete.

## Group join audience

`GroupJoinNotifsService` drops the group's leaders from the `group_member_joined` audience. This replaces the "every existing member and leader" audience in `docs/provenance/01a11f9d-b3d3-7000-998a-59cea0d92543-group-join-notification/`.

## Forum digest removal

`EmailType.ForumDigest` and `MessageSource.ForumDigest` stay, with no template, because `mail` and `message_tracking` rows of those types record digests already sent, as retired types such as `EmailType.Commitment` do. `forum_digest_log` drops without a backup: it duplicates what those `mail` rows hold. `forumDigestPreference` is retired in the same PR and dropped later (see Retiring a column); its enum type outlives the table, whose `preferenceUsed` column used it.

## Retiring a column

A column the running release maps is retired in one deploy and dropped in a later one. `scripts/deploy_backend.sh` migrates while the old backend still serves, and after a failed health check restarts the old release without reverting the migration, so a dropped column that release still selects fails its every load of the entity. Retiring renames the field `legacy<Name>`, maps it `select: false` without `@ApiProperty`, and keeps its column default, as `Action.legacyReviewers` does: CI's migrations drift check fails on a column no entity maps, and inserts no longer set it.

## Settings screens

- A per-kind "Reset to defaults" deletes that kind's overrides. There is no global reset.
- The channel defaults sit in the settings page's Notifications card, above reminder time and time zone; each section opens at `/settings/notifications/:section` on web and `/notification-settings/[section]` on mobile. Sections with no kind the member can see are not listed. Shared types and save logic live in `shared/lib/notificationSettings.ts` and `shared/lib/useNotificationSettings.ts`.
- Every control on every screen saves through one mutation scope, one request at a time, and reads its save state from the mutation cache, so a save that fails after its screen closes still shows on the next. Each response carries every setting, so applying responses in order leaves the newest last; concurrent saves could otherwise land out of order and show an older setting. A settings fetch still in flight when a save lands read the settings before the save, so it is cancelled and a fresh one started.
- A choice still saving shows by re-resolving the settings on the client (`withChanges`): override, else the channel default, and the default alone for a required kind. It resolves through `resolveSetting` in `@alliance/common/notificationSetting`, the rule the server's `wantsKind` uses, for display only; the server's response replaces it once a save lands. A failed choice shows on its own control only: the "Currently …" lines, the own-setting counts, and the receives-nothing warning describe the settings still in effect, and "Reset to defaults" resets it with the kind's saved overrides. The shared hook owns which value a control shows (`shownDefault`, `shownOverride`, `resetOf`), so web and mobile follow one rule.
- A saved phone number refreshes the settings, so the text notice follows the number on file. With no textable number the notice asks for a valid one; with STOP on file it says to reply START, the keyword the SMS webhook honours.
- Mobile reads the device's push permission when the screen mounts and whenever the app returns to the foreground, so coming back from the device's settings updates the notice, which links there. The web app can't read a phone's push permission, so web shows no push notice.
- Mobile registers for push when the app returns to the foreground with permission newly granted, so permission granted in the device's settings takes effect without a restart.

## Admin view

`GET /user/userdetail/:id/notification-settings`, behind `AdminGuard`, returns the member's four channel defaults and every stored override with its kind's label, its channel, its value, its `source`, and whether it is in effect. It lists stored rows rather than resolved cells, so an override on a kind the member can't set now, such as a leader-only kind for a member who leads no group, still shows, marked not in effect. In effect means `cellProblems` would accept the cell from this member, the rule the settings `PATCH` applies, so the admin view and the member's screens agree on which overrides count. The user detail page shows it in its own section, which loads apart from the member so a failure there leaves the rest of the page up.

## Delivery

Stacked PRs. The independent ones land first in any order: the contract reminder, the group join audience, and the forum digest removal. Then the server core: kinds, policy, `notification_preference`, the override-writing migration, the resolver, sender rewiring, in-app visibility, and the new endpoints. Then the web and mobile screens, then the admin view. The core and screens PRs deploy together: the migration reads the old columns once, so a change saved through the old screens after it would be lost. The core's first change stops `UpdateProfileDto` accepting the old notification fields and takes their controls off both screens, leaving reminder time and time zone; from then until the new endpoint, no member can change a notification setting, so each step in between reads settings no one is changing.

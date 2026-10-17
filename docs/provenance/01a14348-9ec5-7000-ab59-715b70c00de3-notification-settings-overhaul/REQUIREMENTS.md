---
user: Charles Lien
task: Overhaul member notification settings into one model of channel defaults and per-kind overrides, applied to every notification kind
---

## Scope

- Every member notification kind moves onto one settings model. This is an overhaul: existing settings, columns, and sending rules carry no weight merely because they exist. (user-originated)
- The migration preserves each member's current delivery: a member who changes no setting afterward receives exactly the notifications they receive today, on every kind and channel, except where another requirement here changes it. No member's settings are reset. (user-originated)
- Notification flows that look dormant stay in scope as kinds; removing them is a separate cleanup. The forum digest is the exception (see Removals). (user-originated)
- Notification emails gain no settings or unsubscribe link in this change. (agent-proposed, user-approved)

## Model

- Four channels: in-app, push, text/SMS, email. Each member has one default per channel. (agent-proposed, user-approved)
- Each kind × channel cell either follows that channel's default live or holds an explicit On/Off override. Changing a channel default moves every cell that follows it and leaves overrides untouched. (agent-proposed, user-approved; the user asked that settings be inherited "intelligently")
- An explicit On override sends even when the channel default is Off. (agent-proposed, user-approved)
- New accounts start with every channel default On and no overrides. (user-originated)
- Who can be reached stays separate from what a member prefers. Active-agreement requirements, a valid phone number, SMS STOP (`phoneNumberUnsubscribed`), registered devices, and per-post gates such as `post.notifyForReplies` keep their current behavior, except that contract suspension notices no longer require an active agreement. (agent-proposed, user-approved)

## Kinds

- Every notification category is its own kind. (user-originated)
- Action notifications are four kinds: "New action announced" (announcements), "Action reminders" (reminders and member-scheduled personal reminders, including social-proof wording variants), "Missed deadline" (missed-deadline notices and missed-suite notices), and "Action updates". (agent-proposed, user-approved)
- "Comments and replies" is one kind covering replies to your comments, new comments on your posts, and new comments on your activity, replacing `pushesForComments` and `receiveReplyNotifications`. SMS and email go only for replies to your comments. When both SMS and email are on, a reply sends both, replacing today's email-only-when-SMS-can't-send fallback. (kind and label: agent-proposed, user-approved; sending both: user-originated)
- "Group members with uncompleted tasks" is a kind replacing `remindAboutUncompletedGroupMembers`. (agent-proposed, user-approved)
- Every kind that only group leaders can receive is leader-only: "Group members with uncompleted tasks", "A member joined a group you lead", a member removed from a group you lead, a member left, a member suspended and removed, and community and one-time invite requests to join your group. (agent-proposed, user-approved)
- "Someone joined your group" (`group_member_joined`) goes to the group's members and never to its leaders. Leaders get "A member joined a group you lead" (`member_joined_community`) for the same join. (user-originated) That kind offers in-app and push only, so leaders who get join texts today stop getting them. (agent-proposed, user-approved)
- When an invited member accepts, the inviting leader gets only "X accepted your invitation to join your group" (`community_invite_accepted`); the group's other leaders get "A member joined a group you lead". (user-originated)
- Each of these notification categories is its own kind, the leader-only ones above included: friend requests, accepted friend requests, likes, messages, assigned to a group, removed from a group, a member removed from a group you lead, a member left, a member suspended and removed, someone you invited joined, and each community and one-time invite or invite-request outcome. (user-originated)
- "Assigned to a group" covers only a member's own assignment. Leaders told that staff assigned someone to their group get "A member joined a group you lead". (user-originated)
- Ambassador recruiting-goal notices (goal halfway and goal ended) are their own kind, apart from "Someone you invited joined". (agent-proposed, user-approved)
- "Contract suspended" is a required kind: it follows the member's channel defaults and accepts no per-kind override. It is the only required kind. (agent-proposed, user-approved)
- A kind offers in-app where it creates an inbox entry, plus the channels it sends on today. No kind gains a new sending channel. (agent-proposed, user-approved)
- Kinds that ignored the general channel toggles until now, such as group membership pushes, join the settings model like every other kind: each of their cells follows the member's channel default unless it holds an override. The migration writes On overrides where needed, so members keep receiving them as they do today. (agent-proposed, user-approved)
- Turning in-app off for a kind hides its future inbox entries without suppressing its other channels. Existing entries stay, and turning in-app back on reveals no backlog. (agent-proposed, user-approved)

## Settings screens

- The settings page is friendly to use, without a long wall of toggles. (user-originated)
- Web and mobile share one layout. (agent-proposed, user-approved)
- The settings page shows the four channel defaults, then links to sections. Each section opens its own page listing its kinds, and a kind expands in place to edit it. (agent-proposed by Codex, user-approved)
- Sections group kinds intuitively. Actions, Groups, Forum & messages, and Friends & likes is a starting point that implementation may change. (user-originated)
- An expanded kind shows an example of what the notification says, rendered with sample names and groups by the same code that writes the real notification. (user-originated idea; rendering and placement agent-proposed, user-approved)
- Each editable cell offers Follow default / On / Off and shows the resulting value, such as "Currently on · from default". (agent-proposed, user-approved)
- A required kind shows locked as following the member's defaults. (agent-proposed, user-approved)
- A channel a kind doesn't offer is hidden for that kind. (agent-proposed, user-approved)
- Leader-only kinds are hidden from members who lead no group; overrides they set earlier stay stored. (agent-proposed, user-approved)
- When a channel can't currently deliver, the screen says so separately from the setting and leaves the setting as it is. Examples: push permission denied on the device ("Push is blocked on this device", linking to device settings), no phone number, or SMS STOP. (agent-proposed by Codex, user-approved)
- Each control saves as it changes and shows its own saved state. A failed save keeps the member's choice visible with a "Try again" link, and the previous setting stays in effect. (agent-proposed by Codex, user-approved)
- Under a channel default, a note counts the kinds with their own setting for that channel, such as "3 notifications have their own setting for Push". (agent-proposed, user-approved)
- When all four channel defaults are Off and no override is On, the settings page warns: "You will not receive any notifications. Please keep a notification channel enabled if you need reminders to complete actions on time." (agent-proposed, user-approved)
- No deep links to an individual kind for now. (agent-proposed, user-approved)
- The admin user detail page shows a member's channel defaults and explicit overrides, read-only, each override marked as set by the member or carried over by the migration. Implementation may change this format. (agent-proposed; user indifferent)

## Storage and migration

- Overrides live in a table keyed by account, kind, and channel, where a missing row means "follow the default". Channel defaults stay on `user`. (agent-proposed, user-approved)
- Each member's push, SMS, and email defaults start as their current general toggles for those channels: `pushNotifsForActions`, `textNotifsForActions`, and `emailNotifsForActions`. The migration writes an override only for a kind whose current delivery on a channel differs from that default; every other cell follows the default. (user-originated)
- Old mobile app versions get no compatibility layer; the app already prompts for the latest version on every launch. (user-originated)

## Removals

- Delete the forum digest: its daily job, `forumDigestPreference`, `forum_digest_log`, and the digest email. (agent-proposed, user-approved) It is completely unused, which makes it a deliberate exception to keeping dormant flows. (user-originated)
- Drop `socialNotifsPreference`. (agent-proposed, user-approved)
- Drop `turnedOffAllNotifs` with no data carried over. No account has it set and none is expected to, since nothing in the app has written it since its member toggle was removed in August 2025. (user-originated)

## Contract reminder

- The never-signed contract reminder stays outside the settings model, beside the welcome and password-reset emails, with no setting and no kill switch. (agent-proposed, user-approved)
- It goes out at most once per account instead of once per email address. An account whose email changes never gets a second one. (user-originated)
- Accounts that already received one keep counting as reminded. An account whose email was changed outside the app after its reminder may get one more; that gap is accepted. (agent-proposed, user-approved)

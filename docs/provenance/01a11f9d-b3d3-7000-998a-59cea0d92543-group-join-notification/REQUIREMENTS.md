---
user: Charles Lien
task: Group join notification
---

## Scope

Add a group-join notification delivered through in-app entries, push, and SMS. Email and A/B testing are outside this feature.

User-originated constraint: preserve all existing notifications, including their copy, recipients, delivery behavior, and settings. The new notification is additive.

## Message content

The message templates have unknown authorship. The full-name and destination choices are agent-proposed and user-approved.

| Channel         | Exact template                     |
| --------------- | ---------------------------------- |
| Push and in-app | `#{name} joined #{group}!`         |
| SMS             | `#{name} joined #{group}! #{link}` |

`#{name}` is the joining member's full name. `#{group}` is the group's name. `#{link}` opens that group's Members tab; push and in-app navigation open the same destination on web and mobile. Use these templates for every join path.

## Triggers and audience

Origin: agent-proposed, user-approved.

- Trigger on actual membership additions through public joins, accepted invitations, signup through group invitations/referrals, staff assignments or transfers, and returns after agreement reinstatement. Genuine rejoins count; pending invitations and unsuccessful joins do not.
- Notify every existing member and leader, including leaders with paused agreements. Exclude the joining member.
- A batch assignment uses the audience present before the batch. Creating a group sends no join notifications.
- Send one immediate new notification per joining member. There is no digest, cooldown, or historical sending at rollout.

## Notification settings

Origin: agent-proposed, user-approved.

- Provide account-wide “New group members” settings on web and mobile, with independent Push and Text/SMS toggles.
- Apply these settings only to the new notification. Existing invitation, departure, removal, assignment, and leader notifications retain their behavior.
- In-app entries remain visible when either or both toggles are off.
- For existing and new accounts, push defaults on and SMS defaults off until enabled.
- Keep these preferences independent of action-reminder preferences. Honor the overall outbound notification opt-out and SMS unsubscribe status.

## Complexity constraint

User-originated constraint: handling departures before delivery and delivery failures should use the simplest behavior supported by the existing code, without introducing complications.

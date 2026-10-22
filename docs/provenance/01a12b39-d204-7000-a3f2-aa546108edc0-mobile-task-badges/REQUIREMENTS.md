---
user: Charles Lien
task: Specify and implement unfinished-task badges for the mobile app and matching web task counts
---

# Task badges

## Scope

- **User-originated:** Add mobile notification badges driven by tasks appearing on the home page, with eligibility determined by task type.
- **Agent-proposed, user-approved:** Show the eligible task count on the phone's app icon and the mobile Tasks tab, on iOS and Android. Apply the same counting rules to the website's Tasks badge.
- **Agent-proposed, user-approved:** Count unfinished tasks, not unseen tasks. Opening the app, viewing a task, or reading a notification does not clear its contribution. Count each eligible action once; remove it after completion, dismissal, withdrawal, or loss of eligibility. Zero clears the badge.
- **Agent-proposed, user-approved:** Unread messages and notifications do not contribute to the app-icon badge. Retain their existing separate in-app badges.
- **User-originated:** Eligibility rules are fixed in code. Admin controls, per-item overrides, and configurable rules are out of scope; changes to the policy require a later code change.

## Eligibility

Consider actions that would appear among the signed-in user's home tasks under the existing assignment and completion rules. The exclusions below take precedence over an inclusion.

| Item or condition                                       | Contributes                                            | Origin                        |
| ------------------------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| Required action                                         | Yes                                                    | Agent-proposed, user-approved |
| Onboarding action                                       | Yes                                                    | Agent-proposed, user-approved |
| Action marked optional by an admin                      | Yes, subject to exclusions                             | User-originated               |
| Membership-gap assignment                               | No, even when the action is also admin-marked optional | User-originated               |
| Currently away                                          | No                                                     | Agent-proposed, user-approved |
| Previously away during the task                         | No                                                     | Agent-proposed, user-approved |
| Scheduled to be away during the task                    | No                                                     | Agent-proposed, user-approved |
| Follow-up form                                          | No                                                     | User-originated               |
| General update                                          | No                                                     | Agent-proposed, user-approved |
| Past-deadline action, including one still shown on Home | No                                                     | Agent-proposed, user-approved |
| Staff preview of an unreleased action                   | No                                                     | Agent-proposed, user-approved |

Use the task's existing away classification for the three absence exclusions. A membership-gap assignment means the member's contract does not cover the full action window under the existing assignment rules; the action being optional for everyone does not override that exclusion.

## Update timing

- **User-originated:** Decreases caused by completing a task must happen immediately so a completed task does not leave an annoying badge behind.
- **Agent-proposed, user-approved:** On the device where completion, dismissal, or withdrawal succeeds, update the Tasks badge and app-icon badge immediately after server confirmation. Do not wait for polling, a second fetch, or a completion animation. A failed operation does not remove a task's contribution.
- **Agent-proposed, user-approved:** Remove an expired task's contribution at its known deadline while the app is running.
- **Agent-proposed, user-approved:** Send count decreases caused by the user's own changes to their other devices immediately, without waiting for the periodic refresh. This includes completion, dismissal, or withdrawal on the website or another device, and the user's edits to their own away dates.
- **Agent-proposed, user-approved:** Decreases caused by admin edits (cohort, action edits, archiving) or by a deadline passing may reach devices where the app is not running within roughly one minute.
- **Agent-proposed, user-approved:** Increases, including newly available tasks, may take up to roughly one minute to appear. Refresh immediately when the app opens or returns to the foreground.
- **Agent-proposed, user-approved:** Keep the app-icon badge updated while the app is closed, on iOS and Android. Android's closed-app updates require a new native module, so they reach users with the next store build; until then Android updates the app-icon badge only while the app runs. Delivery is best effort because the operating system can delay background updates; foreground refresh reconciles the count. The one-minute allowance for increases is not a guarantee of background delivery.

## Notifications, failures, and accounts

- **Agent-proposed, user-approved:** Badge-only updates are quiet: no banner, sound, or extra notification-list item. Preserve existing push-notification behavior separately.
- **Agent-proposed, user-approved:** During a failed refresh or offline period, retain the last known count rather than replacing it with zero. Confirmed local changes and known deadlines still apply. On an initial load with no known count, keep the badge absent until data arrives.
- **Agent-proposed, user-approved:** Use the existing notification permission flow, without additional prompts or badge settings. When permissions prevent app-icon badges or an Android launcher does not support them, the in-app Tasks badge remains available.
- **Agent-proposed, user-approved:** Clear the device's badge on logout or account switching. Logout unlinks the device from the account on the server, so it receives no pushes of any kind (badge, message, or notification) for that account until someone signs in. Load the newly signed-in account's count after authentication.

## Delivery scope

- **User-originated:** Implement this specification.

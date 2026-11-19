---
user: Charles Lien
task: Redesign the "This form can't be displayed" state on mobile and web. Members don't read its text, check the app store, find no new version, and send screenshots; restarting the app fixes it. The design should change so members don't get stuck.
---

# Requirements

## Mobile: content the app is too old to show

Agent-proposed, user-approved.

- The box fixes the problem itself rather than asking the member to diagnose it.
- If an over-the-air update is already downloaded, it shows one prominent "Restart to update" button straight away.
- Otherwise it shows "Getting the latest version…" while it checks for and downloads an update, then the same button.
- If no over-the-air update exists but the app store has a newer build, the button opens the store ("Open App Store" / "Open Play Store").
- If nothing newer exists anywhere, it says so plainly, with no restart advice.
- After the restart the member lands back on the same screen. Something opened on top of it, such as a task flow, needn't reopen. User-originated.
- It never tells members to download from the store unless the store has a newer build.

## Web

Agent-proposed, user-approved.

- The box shows a "Reload page" button. The page never reloads by itself.

## Content that is broken, not too new

Agent-proposed, user-approved.

- When the form or update itself is wrong (no newer client would show it), the box reads "There's a problem with this form." (or "update") and "Please try again later.", with no restart or update advice and no claim that anyone has been notified.

## Alerts for broken content

Agent-proposed (research and second opinion), user-picked.

- A form broken for everyone posts to Slack once per piece of content per day, not once per member who opens it: `content_unrenderable` leaves the main Slack destination and gets its own PostHog Slack destination, posting to the same channel, that drops repeats for the same form or update for 24 hours.
- The member apps (the web frontend and mobile) report content they can't show for every viewer, staff previews included: a staff preview of an unlaunched action and an admin viewing a draft or archived action report like any member. User-originated.

## Getting updates to members sooner

- No gate that delays publishing content using a new kind until clients have adopted it: a feature has to be able to reach members within hours from a single push. User-originated.
- The admin app deploys only after the mobile over-the-air update job for the same deploy has finished, so admins can't use a new kind before a mobile bundle that shows it exists. This orders publishing; it doesn't guarantee members have installed the update. Agent-proposed, user-approved.
- Tapping a push notification, or receiving one while the app is open, checks for an over-the-air update immediately, ignoring the 15-minute limit on foreground checks. Applying the update still needs a restart. Agent-proposed, user-approved.
- When an over-the-air update has been downloaded and the app returns to the foreground after at least 30 minutes in the background, the app restarts into the update behind the splash screen and reopens the screen the member was on. Brainstormer-proposed, user-approved over the agent's recommendation to wait for data first.
- That automatic restart waits while any screen or sheet holds unsaved input (typed text or picks) kept only in memory, such as the new forum post screen, the message composer, recipients and attachments on the new-message screen, comment and invite forms, the create-group form and the withdrawal sheet; it blocks while the screen or sheet holds any, and updates still apply everywhere else. The KORA review screen, whose unsaved notes live in a web view the app can't see into, blocks the restart for as long as it is open. Saving drafts for these screens isn't part of this task. Agent-proposed (second opinion and vendor research), user-picked.

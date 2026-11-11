---
user: Charles Lien
task: Show a banner or button when an OTA update is available that relaunches the app on tap; research the industry standard for this on mobile and on the web, which takes precedence over the user's suggestions
---

- **User-originated:** The industry standard for surfacing an available update takes precedence over the user's own UI suggestions.
- **User-originated:** Mobile shows a banner or button when an over-the-air update is available, and tapping it relaunches the app into the update.

## Mobile (apps/mobile)

- **Agent-proposed, user-approved:** While the app is running, check for an update each time it returns to the foreground, at most once every 15 minutes, and download it in the background.
- **Agent-proposed, user-approved:** Once the update is downloaded, show a non-modal banner, "A new version of Alliance is ready", with a "Restart" action that reloads into the update with the splash-styled reload screen, and a close control. The app never reloads into an update without that tap; an update not taken applies on the next cold start as it does today.
- **Agent-proposed, user-approved:** The banner sits at the top of the screen, below the status bar.
- **User-originated (choice between agent options):** A dismissed banner shows again each time the app returns to the foreground while the update is still pending.
- **Agent-proposed, user-approved:** The existing cold-start update gate stays as it is.

## Web (apps/frontend)

- **Agent-proposed, user-approved:** No update banner. Once the tab learns a newer build is deployed, its next in-app navigation to another page loads as a full document, so it lands on the new build. The page never reloads by itself.
- **Agent-proposed, user-approved:** The tab detects a new build by comparing the commit SHA it was built with against the deployed build's commit SHA, fetched from an uncached endpoint when the tab becomes visible and on a slow interval while it is visible. Developers do nothing per change; the SHA comes from the build.
- **User-originated:** Keep the previous build's assets reachable after a deploy, in this change. (The deploy already keeps a week of earlier builds' hashed assets; see DECISIONS.md.)

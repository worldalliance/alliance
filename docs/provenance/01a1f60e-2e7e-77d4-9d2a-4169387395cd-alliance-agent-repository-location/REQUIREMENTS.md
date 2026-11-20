---
user: Charles Lien
task: Do ALL-2033 (Alliance agent: find or clone the repository) on the current local branch, then create a PR
---

## Finding or cloning the repository

- The app uses an existing checkout of the repository when it finds one or the user points to it. Otherwise it clones into a visible folder the user can change, defaulting to `~/alliance/workspaces/alliance`, so worktrees collect in `~/alliance/workspaces/`. The app's own settings, state and caches go in the platform's application folders, never beside the checkout. (agent-proposed, user-approved; restated from 01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app)
- Done when a fresh machine ends with a checkout at the default path and a machine with an existing checkout keeps using it. (ALL-2033-proposed, user-approved)
- On a machine with no copy of the repository, the app starts cloning to the default folder by itself, showing the folder with "Change" and "Cancel", and chat stays usable while it clones. (agent-proposed, user-approved)
- The app looks for an existing copy only in the saved choice, the copy a development build runs from, and the default folder; any other copy comes in through "Use existing copy". It doesn't search the disk. (agent-proposed, user-approved)
- When a found copy's scripts don't support what the app needs, the app shows "Update needed". It offers a fast-forward to the latest `main`, which the user confirms, only when the copy is on `main` with no uncommitted changes; otherwise it explains what to do. (agent-proposed, user-approved)
- Until tasks replace it (ALL-2035), the folder picker for a new conversation stays, and a new conversation defaults to the repository rather than the last folder used. (agent-proposed, user-approved)
- The UI calls it the "Alliance repository", with the actions "Clone" and "Use existing copy", and says in one plain line: "Agents work on their own copy of this for each task." (agent-proposed, user-approved)

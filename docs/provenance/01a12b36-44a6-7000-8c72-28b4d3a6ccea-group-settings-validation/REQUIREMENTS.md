---
user: Charles Lien
task: One rule for validating a group's settings when it is created or edited
---

## Requirements

- Group create and edit validation in the web app, the mobile app and the admin panel follows one rule held in one place, so the forms cannot diverge. (user-originated)
- Client validation matches what the server enforces; the server is the authority. (user-originated)
- Where the copies disagree, the correct rule is chosen from the history of the code, and a failing test reproduces each wrong copy before it is fixed. (user-originated)
- The mobile inline group creators (one-time invite and invite share link) share their default group settings with the group create forms instead of hard-coding them. (user-originated)
- Where the admin panel differs from the member-facing apps, the difference is explicit in the code, not accidental. (user-originated)
- Invalid inputs to the shared rule have tests. (user-originated)

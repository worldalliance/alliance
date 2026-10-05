---
user: Alex Dorey
task: Let team members test the mobile app against the `main` branch (staging) through a separate staging app
---

# User-origin requirements

- The team needs to test how the mobile apps work with the `main` branch, which deploys to staging and is queued for production.
- The user was already considering a separate testing app for team members only.

# Approvals of agent proposals

These selections approve agent-authored recommendations; the user did not independently propose their details. The recommendations and rationale are in DECISIONS.md.

1. **Approach.** Of the options the agent listed, the user chose the separate staging app (internal distribution, its own bundle ID, pointed at the staging API) that receives `main` over the air from the staging deploy.
2. **Scope.** The user asked the agent to start on the code changes from the agent's checklist: mobile code, server and web changes for sign-in against staging, and CI. Apple, Google Play, Firebase, Google Cloud and EAS console setup stay with the user.
3. **Native rebuilds.** When `main`'s native fingerprint has no staging build, the staging deploy warns and the team rebuilds by hand. The user chose this over CI building and submitting automatically.
4. **Web links.** Links the staging app opens or shares on the web keep pointing at production.
5. **Android first.** The staging config refused to load without a Google iOS client ID. Offered either supplying the ID or relaxing the check, the user said "unblock Android": staging Android builds go ahead without the ID, and iOS builds still need it.

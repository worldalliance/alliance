---
user: Charles Lien
task: Deduplicate the mobile app's source for the web origin of shared and browser-opened links
---

- Find duplicated code and deduplicate it so that code likely to change together has a single source of truth, preventing behavior divergence. One deduplicated item per standalone commit. (user)
- The deduplicated item: every link the mobile app shares off the app or opens as a web page takes its origin from one function, so the web domain moves in one place. API calls, uploads, and websockets stay on the API origin. (agent-proposed, user-approved)

---
user: Charles Lien
task: One server definition of whether a member has a profile picture, in TypeScript and SQL
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. Copies that would legitimately evolve independently stay separate. (user-originated)
- One server implementation decides whether a member has a profile picture, with a TypeScript form and an SQL form. The public member directory, the signup social-proof friend and random-member pickers, the UploadedPhoto task validator, and the global feed new-member facepile ordering all read it. (agent-proposed, user-approved)
- One standalone commit for this item. (user-originated)

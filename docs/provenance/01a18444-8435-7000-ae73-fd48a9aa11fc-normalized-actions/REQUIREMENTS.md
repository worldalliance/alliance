---
user: Charles Lien
task: Normalize shared action state and assess further entity migrations
---

- User requirement: Data representing the same action should stay consistent across list and detail endpoints and their consumers.
- Agent-proposed, user-approved: Pilot a normalized action store while retaining TanStack Query for requests. Verify list loads, detail loads, mutations, delayed responses, and session changes.
- User constraint: Treat the cost of writing boilerplate as negligible because agents perform most repository edits.

---
user: Charles Lien
task: Mobile's group invites tab decides which invites are pending through the shared bucketing rules
---

## Requirements

- Duplicated code is consolidated by its likely future changes, so a later change has one source of truth and behavior cannot diverge; copies that would legitimately evolve independently stay separate. Judgment over line count. (user-originated)
- One deduplicated item, in standalone commits. (user-originated)
- The decision of which group invites a leader must act on, or is waiting on, lives in one place: `bucketOnetimeInvitesByActionability` and `bucketCommunityInvitesByActionability` in `shared/lib/inviteUtils.ts`. Mobile's group invites tab uses them instead of filtering statuses itself. The mobile UI may present the buckets in its own way. (agent-proposed)
- Mobile's status labels in the group invites tab are folded into a shared label map only where they express the same rule. (agent-proposed)
- Where the shared rule surfaces invites needing a leader action that mobile cannot perform, and the web has that action with an existing server endpoint, mobile gains it in its own commit. A large feature is reported instead of built. (agent-proposed)
- The shared helpers have unit tests. (agent-proposed)

---
user: Charles Lien
task: One source of truth for the server-side PostHog client
---

Origin: user

Deduplicate code by its likely future changes, not by lines deleted, so that later changes have a single source of truth and behavior cannot diverge. Use judgment rather than deduplicating blindly. Each deduplicated item is one standalone commit.

Origin: agent-proposed, user-approved

The server creates its PostHog client, and decides whether that client sends anything, in one place, unless code or history shows a deliberate reason for a site's own rule; that reason is kept explicit. Test fixtures that construct their own client stay as they are. A unit test covers the enable rule.

---
user: Charles Lien
task: Route member-facing relative times through the shared formatTime
---

# Requirements

- Deduplicate code so that things likely to change together live in one place, which keeps a single source of truth and prevents behavior divergence. Line count saved is not the criterion. (user)
- Each deduplicated item is one standalone commit. (user)
- Deduplicate with judgment for good coding practice, not blindly. (user)
- Relative "how long ago" times shown to members go through `formatTime` in `shared/lib/utils.ts`, so they read like the rest of the app ("2 hours ago", not "about 2 hours ago"). Covers the web and mobile action timeline, the mobile action update card, and web forum replies. (agent-proposed, unconfirmed)
- Countdowns, deadline "{X} left" text, and admin-only displays are out of scope. (agent-proposed, unconfirmed)

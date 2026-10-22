---
user: Charles Lien
task: One max reply depth for comment threads on web and mobile
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. (user-originated)
- The maximum depth at which a comment takes replies is one product rule, defined once in `shared/` alongside the comment-tree logic and read by both the web and mobile comment threads. (user-originated)
- The mobile indent cap may stay platform-specific, decoupled from the reply rule. (user-originated)
- The shared depth is 6: a comment at depth 0 (top level) through 5 shows Reply; a comment at depth 6 or deeper does not. Web previously allowed replies through depth 9. (agent-proposed, not yet reviewed)
- Comments already deeper than the limit still render. (agent-proposed, not yet reviewed)
- The server does not enforce the limit in this change. (agent-proposed, not yet reviewed)

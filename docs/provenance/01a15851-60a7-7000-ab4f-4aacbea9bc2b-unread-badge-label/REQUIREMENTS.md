---
user: Charles Lien
task: One rule for how count badges cap large counts
---

# Requirements

- (user) Deduplicate by likely future change: code that should change together lives in one place, so the copies cannot diverge.
- (user) The deduplication lands as one standalone commit, covering this one item.
- (agent-proposed, user-approved) A count badge shows nothing for 0, the exact number from 1 to 99, and "99+" above 99.
- (agent-proposed, user-approved) The rule lives in one helper in `shared/lib/` used by the web side nav badges, the web notifications bell, and the mobile tab bar badges.
- (agent-proposed, user-approved) Every badge lays out "99+" without clipping or overflow.

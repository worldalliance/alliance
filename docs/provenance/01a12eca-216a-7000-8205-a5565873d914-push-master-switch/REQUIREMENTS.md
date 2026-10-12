---
user: Charles Lien
task: One rule for whether a member may receive a push of each notification category, with "turn off all notifications" blocking every category
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. Copies that would legitimately evolve independently stay separate. (user-originated)
- One server implementation decides whether a member may receive a push of a given notification category. The push dispatcher's notification and unread-content paths and the action update recognition push all read it. (user-originated)
- A member with "turn off all notifications" (`turnedOffAllNotifs`) set receives no push of any opt-in category: action updates, forum replies, likes, friend requests, accepted friend requests, and new group members. (user-originated)
- A member with `turnedOffAllNotifs` set also receives no push of the categories that have no per-category preference: action events, community invites and their outcomes, community removals, members joining or leaving a community, community assignment, new referred members, and one-time and community invite requests. (agent-proposed)
- Tests cover the master switch for every category. (user-originated)
- Minimal standalone commits. (user-originated)

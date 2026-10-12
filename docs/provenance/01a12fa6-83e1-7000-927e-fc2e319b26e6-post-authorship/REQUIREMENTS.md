---
user: Charles Lien
task: One rule for a forum post's byline authors and for who may edit or delete it, shared by server, web, and mobile
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. Copies that would legitimately evolve independently stay separate. (user-originated)
- One standalone commit for this deduplicated item. (user-originated)
- A post's byline credits its co-author list (`authors`) when that list is non-empty, else its creator (`author`). The server's HTML export, the web post list and post page, and the mobile post list and post screen all read the one implementation. (agent-proposed, user-approved)
- The creator and every co-author may edit and delete a post; nobody else may. The server's update and delete endpoints, the web post page, and the mobile post screen all read the one implementation. (agent-proposed, user-approved)
- Mobile shows co-authors in the byline and shows co-authors the Delete control, matching web. (agent-proposed, user-approved)

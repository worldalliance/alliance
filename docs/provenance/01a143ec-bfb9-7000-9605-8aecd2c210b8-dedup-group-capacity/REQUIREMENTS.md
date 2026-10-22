---
user: Charles Lien
task: One definition of who can be placed in or join a group
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Land the item as one standalone commit.

Origin: agent-proposed, user-approved

Whether a group has room, and for which kind of placement, has one definition shared by the server and every client: the non-leader member count, the free seats under `maxCapacity`, and the predicates for automated referral, staff assignment, public join, a returning member, and being at capacity. The admin group pickers, the public Join button, and the invite form's open-seat count use that definition, so they never offer a placement the server rejects. The move is a pure refactor: where copies disagree, the server's behavior wins.

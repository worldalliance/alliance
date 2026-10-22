---
user: Charles Lien
task: One definition of who may modify or delete an invite
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Copies that differ on purpose stay separate. Land the item as one standalone commit.

Origin: agent-proposed, user-approved

Who may edit or delete an invite (its inviter, or anyone who may manage the invite's group per `canManageCommunity`) has one definition, used for both one-time invites and community invites. The change is a pure refactor: who may act, and each endpoint's refusal, stay as they are.

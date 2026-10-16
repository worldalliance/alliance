---
user: Charles Lien
task: One definition of the member-action deadline for server and clients
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Use judgment rather than deduplicating blindly. Land the item as standalone commits covering this one deduplicated item.

No action has more than one member-action phase; the code does not need to handle several.

Origin: agent-proposed, user-approved

The member-action phase of an action is opened by its member_action event and closed by the deadline event. The server, `shared/`, and the admin app compute that phase, and its deadline, from one definition in `common/`, operating on `{ date, newStatus }` events, next to `eventInEffectAt`. Where a client already receives the server-computed deadline, it may use that instead. The PR says whether action events reach clients sorted by date, and so whether any client behavior changes.

---
user: Charles Lien
task: Specify and implement notification content stability for newly created notifications
---

# User-origin requirements

- Research how other systems handle notification history before recommending a policy.
- Show a person's current name after they change it, including in past notifications covered by the new policy.
- Freeze copy when notifications are sent to the inbox, rather than when a member reads them.
- Keep all existing notifications as they are. Apply this change to new notifications; the user may migrate older records manually later.
- Preserve the existing grouped-like behavior.

# Approvals of agent proposals

These selections approve agent-authored recommendations; the user did not independently propose their details. The recommendations and rationale are recorded in DECISIONS.md.

1. **Wording and identities.** The user approved freezing surrounding notification wording, including cosmetic phrasing, while referenced names and avatars remain current. This replaces the initial agent suggestion to permit cosmetic wording changes.
2. **Previews and announcements.** The user accepted the recommendation that comment previews reflect current content, while authored action-update notification copy retains the message delivered to the member.
3. **Object labels and history.** The user approved current group/action names, then clarified that the group someone left is itself an object. The user accepted the explanation: preserve the identity of the group involved in the event and display its current name; preserve the event's participants, action, and time. A deadline communicated in a reminder retains its original value even if the action's deadline changes.
4. **Inbox timing.** The user's clarification above accepts first availability as the freeze boundary. Scheduled notifications can be edited before that point, and read status does not choose the wording.
5. **Unavailable references.** The user accepted hiding notifications for deleted or inaccessible content, retaining historical membership events, and displaying "Deleted member" or "Deleted group" for unavailable identities where necessary.
6. **Like groups.** The user approved the explanation of existing behavior: unread groups can gain or lose likes; read groups retain their recorded participants/count. Names and avatars in groups covered by the new policy remain current.
7. **Scope and delivery.** The user accepted consistent behavior across web, mobile, and future push messages, with identity updates appearing on notification reload. Already delivered pushes remain as sent. A new admin interface for modifying notification history is outside this change.
8. **Legacy boundary.** The user accepted keeping pre-rollout records on their existing behavior even when scheduled delivery or another grouped like occurs after rollout. Only newly created notification records use the new policy.
9. **Names inside prose.** The user accepted preserving names manually written in announcement copy. Dynamic names require an explicit system reference to a person, group, or action; saved prose must not be searched to guess replacements.

# Scope limits

The user first asked for a specification only, then asked to implement it and allowed the agent to revise DECISIONS.md as it sees fit. The requested old-record policy supersedes the agent's earlier suggestion to backfill copy or recover names from historical notifications.

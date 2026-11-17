---
user: Charles Lien
task: For the SMS chat on the member page, add a feature to mark a conversation as handled so it doesn't show up in "Needs reply".
---

# Requirements

Extends `01a1c8bb-da2e-7400-b37b-cbd09b464582-member-sms-chat`, whose rule that only a staff text takes a member off the "Needs reply" list this task widens: marking the conversation handled does too.

- Staff can mark a member's text conversation as handled from the Texts section of the member's admin page. A handled member leaves the "Needs reply" list. (user-originated)
- The control is only on the member page; the "Needs reply" list gets no per-row control. (agent-proposed, user-approved)
- A handled member comes back on the "Needs reply" list when they send a new text. (agent-proposed, user-approved)
- An admin can mark a handled conversation as "needs reply" again, which undoes the mark handled and puts the member back on the list. This is how a mistaken mark handled is undone; there is no confirmation dialog or undo toast. (user-originated)
- Every mark handled and mark needs reply is kept as history, recording who did it and when. Marking needs reply adds to that history rather than erasing the earlier mark handled. (agent-proposed, user-approved)
- The thread shows each of those actions as a line where it happened, naming who did it and when, such as "Marked handled by Sam · Nov 16, 2:14 PM" and "Marked needs reply by Kim · Nov 16, 3:05 PM". (agent-proposed, user-approved)

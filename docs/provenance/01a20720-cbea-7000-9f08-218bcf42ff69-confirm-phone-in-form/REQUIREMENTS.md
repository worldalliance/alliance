---
user: Charles Lien
task: ALL-2248, web side of member phone verification: confirm a phone number by code inside a task form and in settings, without the code ever blocking the member. Supersedes parts of 01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone, named below.
---

# Requirements

- A task form's phone question that fills the member's profile has a "Send code" button and a code box inside the form, so the member can confirm the number while filling it in. (user-originated)
- A required phone question requires an answer, not a confirmed number. Confirming never blocks moving to the next page, submitting, or completing the action, and there is no confirm step forced between submitting and completing. (user-originated)
- A number a member submits on a form without confirming it is saved to their profile as unconfirmed. This supersedes "A member who gives a phone number on a form and does not enter the code finishes the form without a phone number" in 01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone. (user-originated)
- An unconfirmed form answer that differs from the member's number on file replaces it, confirmed or not, as unconfirmed. (agent-proposed, user-approved)
- A form's phone question that fills the member's profile starts out filled with the member's number on file. (agent-proposed, user-approved)
- A member who submits a prefilled profile phone question unchanged gets the welcome text under the existing rule (sent when they have not opted in to texts, no text-notifications answer says no, and the number has not opted out), even if they saved the number in settings, where no welcome text goes. (user-originated)
- The form draft synced to the server, for restoring on another device, carries a profile phone answer equal to the member's number on file as "" (empty), and a device restoring it reads "" on such a prefilled field as the member's number on file then; installed older mobile builds show it as an empty field. A member who deliberately clears the phone field on one device sees it prefilled again on another. Timezone answers are synced in full, as before this task. (agent-proposed, user-approved)
- After a code fails to send, the member can send it again: one failure does not mean the next send fails, whatever the number's country. (user-originated)
- The Slack alerts for failed texts stay as they are. (user-originated)
- The member is told when their number is unconfirmed. (user-originated)
- Where: under the form's phone field, next to "Send code", the line "Confirm your number so we know it’s right."; and in settings, "Not confirmed" next to the number. No completion-card notice and no home-page banner. Status text that appears on its own is announced to screen readers. (agent-proposed, user-approved)
- Settings keeps saving a new phone number without a code, as the form does. Next to a saved unconfirmed number it shows "Not confirmed" and "Send code". When a number is refused because another account holds it, settings offers the code for it, since confirming moves the number to this member. This supersedes, in 01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone, "In settings, the member's existing number stays active until the new one is verified" and the code being required to save a new number. (agent-proposed, user-approved)
- The form and settings ship in this PR; the mobile app follows separately (ALL-2249). (user-originated that mobile is separate; agent-proposed, user-approved that both web parts ship together)
- Saving a number without a code is intended, not a fallback awaiting removal: the planned contract step (ALL-2250) is retired. (agent-proposed, user-approved)
- The work is done on branch `phone` and opened as a PR. (user-originated)

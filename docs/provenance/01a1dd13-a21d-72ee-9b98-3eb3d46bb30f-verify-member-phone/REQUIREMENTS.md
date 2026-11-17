---
user: Charles Lien
task: Verify a member's phone number by one-time code before saving it, allow a number on only one member account, and afterwards link the Slack alert for an inbound text to the member's texts.
---

# Requirements

- A phone number belongs to at most one member account. (user-originated)
- A deleted account does not hold its phone number: only non-deleted accounts count toward the one-account rule, as with email. (agent-proposed, user-approved)
- A member's new or changed phone number is verified by a one-time code sent to it by SMS before it is saved, reusing the repository's existing one-time-code service. This comes before the Slack link below. (user-originated)
- Verifying a number that another account holds, verified or not, moves it to the verifying member: the other account loses the number and staff are alerted. (agent-proposed, user-approved)
- This PR leaves unchanged that any signed-in member can request a verification code for any number, which cancels that number's pending code and spends its send limit, shared with KORA sign-in; scoping both is separate work, ALL-2253. (user-originated)
- In settings, the member's existing number stays active until the new one is verified. (agent-proposed, user-approved)
- Existing members whose numbers were saved before verification existed keep receiving texts. Their numbers are marked unverified and are not backfilled as verified. Sending a text never depends on whether the number is verified. (user-originated that they keep receiving texts; the rest agent-proposed, user-approved)
- Existing members see an optional "Confirm your number" prompt in settings, with no deadline. (agent-proposed, user-approved)
- A member who gives a phone number on a form and does not enter the code finishes the form without a phone number and can add one later in settings. The code never blocks finishing. (agent-proposed, user-approved)
- A form's phone answer that is not saved because another non-deleted account holds the number raises no Slack alert for staff. (user-originated)
- No two non-deleted production accounts share a phone number when this ships, and none will before it does, so no step resolves existing duplicates. (user-originated)
- The Slack alert for an inbound text that is not a STOP or START keyword names the member whose number sent it and links to that member's admin page, where the texts thread is: "Text from Jane Doe (+1…): <body>" with an "Open texts" link. "Unhandled inbound SMS from +1…" stays only for a number matching no member. The event is attached to the member in the event log. (user-originated that the alert links to the member's texts; wording agent-proposed, user-approved)

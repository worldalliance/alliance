---
user: Charles Lien
task: Fix ALL-2253, a member can cancel another member's phone verification code and use up that number's send limit
---

# Phone verification codes per account

Follows `01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone`, whose server change left this open.

- One signed-in member can no longer cancel another member's pending phone verification code, delay it, or use up a send limit that member needs to verify their own number. (ALL-2253-proposed, user-approved)
- Each phone verification code belongs to the account that asked for it: a new request replaces only that account's pending code for the number, the one-minute wait before another code applies only to that account's requests for the number, and only that account can enter the code. (agent-proposed, user-approved)
- Each account may request at most 5 phone verification codes an hour and 10 a day, across all numbers. The per-IP limits stay. (agent-proposed, user-approved)
- A number may receive at most 5 phone verification codes an hour and 20 a day, counted apart from KORA sign-in codes. The account that already holds the number skips this per-number limit, so the owner can always verify their own number. A member changing to a number not yet on their profile gets no exemption, so someone who knows that number can use up its limit first. (agent-proposed, user-approved)
- The change may assume each phone number belongs to at most one live account, as production data shows. The gaps that open only when a member saves another account's number without a code, through the old profile update, until ALL-2259's unique index lands, are accepted: an attacker who saves the owner's number on their own profile can take away the owner's exemption from the per-number limit and use that limit up, and accounts that take turns as the number's only holder each get their own sends to it. (user-originated)
- Codes pending when this deploys stop working; a member with one requests another. (agent-proposed, user-approved)
- KORA sign-in's codes and limits are unchanged; its own version of this flaw, and protecting the Twilio bill from SMS pumping (country restrictions, a daily cap on sends), are separate issues: ALL-2394 and ALL-1908. (agent-proposed, user-approved)

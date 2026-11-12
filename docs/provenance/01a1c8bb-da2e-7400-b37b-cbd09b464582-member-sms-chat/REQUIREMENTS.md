---
user: Charles Lien
task: In the admin panel, on each member's page, add a chat UI where admins text members over SMS/MMS, after researching whether an industry standard exists for such a UI.
---

# Requirements

- Each member's admin page has a chat thread with that member over SMS/MMS: staff send texts from it and the member's replies appear in it. (user-originated)
- First version: the thread shows which staff member sent each outbound message, Twilio delivery status per outbound message with the failure reason when it fails, inbound MMS media inline, an opted-out badge with the composer disabled for opted-out members, an SMS segment counter on the composer, and a "needs reply" signal. Saved replies (reusable message templates) and conversation assignment are out of scope. (agent-proposed, user-approved)
- Staff send text only from the chat; inbound MMS media from members is still shown. (agent-proposed, user-approved)
- The Alliance can't currently send texts to UK (+44) numbers. This task adds no UK-specific logic to staff texting, the thread, the composer or the "Needs reply" list: no field saying whether a member can reply, no UK note and no block on texting UK members. Sending to UK numbers keeps the sender behaviour it had before this task. UK texting and two-way UK replies are fixed later, in ALL-2205. (user-originated)
- The thread shows every text to and from the member's phone number, including past broadcasts and action updates sent before this feature, matched by phone number and backfilled. (agent-proposed, user-approved)
- The thread is paged: the thread endpoint returns the newest 100 texts with a `before` cursor for older ones, and the member page's thread has a "Show older texts" control that loads older texts while keeping the scroll position. Polling refreshes only the newest page. (agent-proposed, user-approved)
- The admin sidebar has a "Needs reply" page listing members whose last message in their thread is inbound, with a count badge on its sidebar entry shown the same way as the existing badge counting members who need group assignment. (agent-proposed, user-approved)
- An automated text, such as a reminder or broadcast, does not clear a member's "needs reply" status; only a text a staff member sends does. (user-originated)
- Inbound MMS media is copied to the Alliance's private S3 storage, then deleted from Twilio; staff view it through short-lived signed URLs. (agent-proposed, user-approved)
- Sending outside 8am–8pm in the member's local time shows a warning that staff can override; it does not block the send. (agent-proposed, user-approved)
- The thread has a "Mark opted out" control for staff, for opt-outs a member writes in free text rather than a keyword, which goes through the same opt-out path as a STOP reply. (agent-proposed, user-approved)

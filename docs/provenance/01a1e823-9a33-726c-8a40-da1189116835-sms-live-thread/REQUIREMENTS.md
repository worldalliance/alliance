---
user: Charles Lien
task: In the admin SMS UI, make it clear when another admin is typing, and use websockets for message refreshes.
---

# Requirements

- In a member's SMS thread in the admin panel, staff can see when another admin is replying to the same member. (user-originated)
- The live features are tied to the phone number's thread, not the member. A draft on a member's page or on that number's thread page shows "<name> is replying…" on both, whether or not a member holds the number. (agent-proposed, user-selected)
- The signal is "composing": another admin has text in a composer for that phone number and has edited it within the last ~10 seconds, shown as "<name> is replying…". Not literal keystroke typing dots, and not who is merely viewing. (agent-proposed, user-selected)
- The composing indicator also shows on the Needs reply list, on the row of the phone number being replied to, and on that number's row of the Texts page. (agent-proposed, user-selected)
- New texts reach the thread and the Needs reply list over a websocket, both a member page's thread and a phone number's thread page, for any number, whether or not a member holds it: the server signals that a thread changed and the page refetches it, refetching again on every reconnect, with slow polling (about 60 seconds) kept as a fallback. The server does not push message payloads. (agent-proposed, user-selected)
- The Texts page, which lists every phone number's thread, is live too: it refetches when the server pushes a thread change, at most once every 5 seconds. This supersedes `01a1e6f9-f8e9-770e-b299-a69524ccbfde-sms-threads-by-number`'s decision that the Texts page doesn't poll and refreshes only when opened, on window focus and after a send or opt-out. (agent-proposed, user-selected)
- On a member's page and on a phone number's thread page alike, when a text arrives in the thread after the composer last saw it, sending is refused with a warning that shows the new texts and offers "Send anyway"; the draft is kept. This is a warning plus confirmation, not a lock, and not an atomic reservation of the thread before the send goes to Twilio. (agent-proposed, user-selected)
- What the composer last saw is the newest text when the current draft started: the first edit into an empty composer, including after a successful send clears it. A refetch never moves it, so any text arriving while the admin writes, the contact's or another admin's, triggers the warning. When the warning shows, it moves to the newest text the warning displays, so "Send anyway" is checked against what was on screen and a text arriving after the warning triggers it again. (agent-proposed, user-selected)
- On a member's page only, since a number thread page's number can't change: when the newest text the composer last saw isn't in the member's current thread, as after their phone number changed, sending is refused separately from newer texts, with "This member's phone number changed while you were writing. Check the thread above before you send." and "Send anyway". A number change while the draft started on an empty thread isn't detected. (agent-proposed, user-selected)

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

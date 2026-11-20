---
user: Charles Lien
task: In the admin SMS UI, make it clear when another admin is typing, and use websockets for message refreshes.
---

# Requirements

- New texts reach the thread and the Needs reply list over a websocket, both a member page's thread and a phone number's thread page, for any number, whether or not a member holds it: the server signals that a thread changed and the page refetches it, refetching again on every reconnect, with slow polling (about 60 seconds) kept as a fallback. The server does not push message payloads. (agent-proposed, user-selected)
- The Texts page, which lists every phone number's thread, is live too: it refetches when the server pushes a thread change, at most once every 5 seconds. This supersedes `01a1e6f9-f8e9-770e-b299-a69524ccbfde-sms-threads-by-number`'s decision that the Texts page doesn't poll and refreshes only when opened, on window focus and after a send or opt-out. (agent-proposed, user-selected)

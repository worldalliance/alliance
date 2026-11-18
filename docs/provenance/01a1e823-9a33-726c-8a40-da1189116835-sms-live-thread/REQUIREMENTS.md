---
user: Charles Lien
task: In the admin SMS UI, make it clear when another admin is typing, and use websockets for message refreshes.
---

# Requirements

- New texts reach the thread and the Needs reply list over a websocket: the server signals that a thread changed and the page refetches it, refetching again on every reconnect, with slow polling (about 60 seconds) kept as a fallback. The server does not push message payloads. (agent-proposed, user-approved)

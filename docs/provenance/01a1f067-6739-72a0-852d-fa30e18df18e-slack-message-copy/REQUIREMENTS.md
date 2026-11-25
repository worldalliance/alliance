---
user: Charles Lien
task: Improve the messages the server sends to Slack, then create a PR
---

# Requirements

Scope is the server's event-log messages (`EventLogService`), which post to the one Slack channel. CI workflow messages are out of scope.

- Every message follows one house style: who it is about, linked → what happened, in plain words → what to do next, if anything. (agent-proposed, user-approved)
- Members, actions and the other things a message names are links, not bare text. (agent-proposed, user-approved; the user's main concern)
- Messages name people and things instead of showing raw database IDs, and show no internal values: enum keys, dedupe keys such as `s-12-13-14`, environment prefixes such as `[production]:`, or emoticons such as `:)`. (agent-proposed, user-approved)
- Messages that someone has to act on say what to do, where that is feasible. Not worth much effort where it isn't. (agent-proposed, user-approved with that condition)
- Each event type has one formatter, in one file. Call sites pass data (the member, the action), not a sentence. The formatter produces both the admin event-log text and the Slack line, and one test renders every event type so the channel's copy reviews as one diff. (agent-proposed, user-approved)
- Links go by task: account and status events (signups, contracts, deletions, texts, admin roles) link to the admin panel; discussion (comments, forum posts) links to the member-facing app. (agent-proposed, user-approved)
- No Slack mentions at all; the hardcoded user mentions on new action comments go. (agent-proposed, user-approved)
- Stop writing the `JoinRequest` event type; keep it in `EventType` so past rows stay readable. (agent-proposed, user-approved)
- Not wanted: routing events to several channels, digests, Slack threads, redacting personal data in Slack. (user-originated)

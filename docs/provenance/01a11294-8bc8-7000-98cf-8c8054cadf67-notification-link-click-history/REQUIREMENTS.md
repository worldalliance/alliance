---
user: Charles Lien
task: Specify durable notification-link click tracking for future analytics
---

# User request

The user wants to know whether text-message link clicks are stored so analytics can be built retrospectively. After the agent identified limits in the current tracking, the user invoked the spec skill for the recommended changes. Implementation has not been requested.

# Accepted recommendations

These choices originated with the agent. The user answered “go with your recommendation” for each. Their behavioral specification and rationale are in [DECISIONS.md](./DECISIONS.md).

| ID  | Agent proposal accepted by the user                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Cover member SMS/email notifications and waitlist email campaigns; retain current push tracking and leave ordinary website clicks outside this change.                                                            |
| R2  | Track links into Alliance across destinations; defer external-link tracking.                                                                                                                                      |
| R3  | Count separate link openings, including before sign-in. Exclude refreshes, duplicate requests, login redirects, and ordinary preview fetches; sophisticated bots may remain indistinguishable.                    |
| R4  | Retain message, intended recipient, channel, destination, click time, platform, and available reminder/action associations. Give email and SMS separate tracking IDs; omit IP addresses and browser fingerprints. |
| R5  | Attribute forwarded links to the original message and intended recipient, without identifying the visitor as that recipient.                                                                                      |
| R6  | Preserve link routing and support tracking on web and mobile when either receives a tracked link. Automatic native-app linking is separate work.                                                                  |
| R7  | Navigation continues during tracking failures. Persist failed events locally and retry for up to 24 hours without creating duplicates.                                                                            |
| R8  | Preserve historical flags; record future openings of old links where possible, with unknown channel when attribution is ambiguous. Defer PostHog history import and avoid inventing past timestamps.              |
| R9  | Events have no automatic expiry. Preserve message/reminder context through reminder edits or deletion. Delete events with their recipient's account or waitlist record.                                           |
| R10 | Maintain the existing click-rate chart and PostHog reporting. Defer new dashboards and reporting endpoints; store sufficient detail in the database for later work.                                               |

# User clarification

For R8, the user permits using the current time for historical data if that makes implementation easier, but explicitly makes this optional. The agent elected to retain unknown historical times; this permission does not require synthetic events.

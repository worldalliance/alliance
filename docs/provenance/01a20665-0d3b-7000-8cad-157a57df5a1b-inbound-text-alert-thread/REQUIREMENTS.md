---
user: Charles Lien
task: Implement ALL-2247 (Slack alert for an inbound text links to the number's thread and records the member) and open a PR.
---

# Requirements

Follows the phone verification plan in `docs/provenance/01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone/`, of which ALL-2247 was PR 2 of 5. Most of that issue's original ask shipped in #1008; these are the remaining parts.

- The Slack alert for an inbound text that is not a keyword links to the number's own thread on the admin Texts page (`/texts/<threadId>`) instead of to Needs reply. (ALL-2247-proposed, user-approved)

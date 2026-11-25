---
user: Alex Dorey
task: Tweak conversation assignment so that a conversation gets fully reviewed (5 of 5 reviews) sooner rather than later.
---

# Requirements

Supersedes the requirement in `01a1c67a-0156-7000-a694-8fc78b1dd41b-kora-review-section-spec` that assignment favours the transcripts furthest from their review target, and the matching choice in `01a1eb68-1a79-7000-abdd-f53b644d2a30-kora-lazy-assignment` and `01a1eaae-fe8a-7000-b0ec-77dbaebdfbd4-kora-lazy-assignment-spec`.

- When picking a reviewer's next conversation, assignment favours the conversation closest to its review target (fewest reviews still needed, at least one), so conversations reach their full review count one after another rather than all near the end. (user-originated for the goal; agent-proposed, user-approved for closest-to-target)
- Everything else about picking stays: a reviewer never gets the same conversation twice; reviews in progress count toward the target; reviewers stay on a topic for up to 3 conversations; ties are broken at random. (agent-proposed, user-approved)

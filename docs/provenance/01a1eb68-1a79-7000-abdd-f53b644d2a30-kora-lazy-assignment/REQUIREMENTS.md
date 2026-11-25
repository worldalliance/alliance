---
user: Alex Dorey
task: Implement the second PR of the KORA lazy-assignment spec, lazy assignment with the 24-hour release and the deploy migration
---

Implements the "Lazy assignment", "Releasing unfinished pairs after 24 hours", "Running out of pairs" and "User-batches that exist when this ships" requirements of `docs/provenance/01a1eaae-fe8a-7000-b0ec-77dbaebdfbd4-kora-lazy-assignment-spec`:

- Pairs are given to a participant when they are needed, not all reserved when the user-batch starts, so a participant who stops partway holds no pairs they haven't reached. (user-originated)
- A user-batch keeps its size and closing date, so the home page's ask ("Rank 10 pairs by November 30") is unchanged. (agent-proposed, user-approved)
- A pair a participant was given and hasn't finished goes back to the pool once 24 hours pass since the last save that changed that pair. (user-originated for the 24 hours; measuring from the last save agent-proposed, user-approved)
- The 24-hour release replaces the 7-day release. (user-originated)
- A released pair always leaves the participant's user-batch. When they return they are given a different pair, and their work on the released pair is discarded. (user-originated)
- The swap is silent. (user-originated)
- When no pair is left to give partway through a user-batch, it ends early and counts as finished with the pairs ranked or skipped, completing the participant's Kora action as a finished user-batch does. (agent-proposed, user-approved)
- At deploy, pairs in unfinished user-batches that the participant hasn't opened go back to the pool; opened, unfinished pairs follow the 24-hour release. (agent-proposed, user-approved)

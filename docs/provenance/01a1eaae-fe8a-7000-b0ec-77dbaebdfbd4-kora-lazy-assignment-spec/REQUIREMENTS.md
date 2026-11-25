---
user: Alex Dorey
task: Spec changing the KORA review system so pairs are assigned lazily when needed, assignments are released back into the pool after 24 hours of not being completed, and opt-out categories persist across assignments
---

Terms, as in `docs/provenance/01a1d62b-2424-7000-b61c-6b4880e75750-kora-active-home-base`: a **pair** is one simulated child talking to two AI chatbots, which a participant ranks. A **user-batch** is one participant's chunk of pairs (a `KoraAssignment`), sized by the newest open batch's `transcriptsPerAssignment`, with a closing date. A pair's **review target** is its batch's `reviewsPerTranscript`.

Supersedes, from `docs/provenance/01a1c74e-af23-7000-a149-25316be9dfa3-kora-review-implementation`, the 7-day inactivity release, and from `docs/provenance/01a1d62b-2424-7000-b61c-6b4880e75750-kora-active-home-base`, the requirement keeping the 7-day release alongside closing dates.

## Lazy assignment

- Pairs are given to a participant when they are needed, not all reserved when the user-batch starts, so a participant who stops partway holds no pairs they haven't reached. (user-originated; how lazily is the agent's choice, user deferred)
- A user-batch keeps its size and closing date, so the home page's ask ("Rank 10 pairs by November 30", "Rank 7 more pairs by November 30") is unchanged. (agent-proposed, user-approved)

## Releasing unfinished pairs after 24 hours

- A pair a participant was given and hasn't finished goes back to the pool once 24 hours pass since the last save that changed that pair. (user-originated for the 24 hours; measuring from the last save agent-proposed, user-approved, chosen over measuring from when the pair was given)
- The 24-hour release replaces the 7-day release. (user-originated)
- A released pair always leaves the participant's user-batch, even if nobody else has been given it. When the participant returns, they are given a different pair in its place, and anything they had marked or answered on the released pair is discarded. (user-originated, chosen over letting them keep it, and over swapping it only once another participant has filled it)
- The swap is silent: no message tells the participant that the pair was replaced. (user-originated, chosen over a one-line notice)

## Running out of pairs

- When no pair is left to give a participant partway through a user-batch, because every remaining pair has reached its review target or is in a category they opted out of, the user-batch ends early and counts as finished with the pairs they ranked or skipped. It completes their Kora action as a finished user-batch does today, and the home page says there's nothing more to rank for now. (agent-proposed, user-approved)

## Lasting opt-outs

- A participant who opts out of a sensitive category is never given pairs from that category again, in this or any later user-batch or batch. (user-originated)
- There is no way to undo an opt-out in this change. (agent-proposed, user-approved)

## Admin view

- The Kora participants admin page (`/kora-participants`) shows, for each category in the open batches, how many reviews its pairs still need to reach their targets and how many participants have opted out of it, so a category starved by opt-outs is visible. (agent-proposed, user-approved)

## User-batches that exist when this ships

- At deploy, pairs in unfinished user-batches that the participant hasn't opened go back to the pool. The user-batch keeps its size and closing date, and the participant is given pairs lazily from then on. Opened, unfinished pairs follow the 24-hour release. (agent-proposed, user-approved)

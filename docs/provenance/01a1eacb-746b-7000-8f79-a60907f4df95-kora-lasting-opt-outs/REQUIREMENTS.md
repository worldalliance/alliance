---
user: Alex Dorey
task: Implement the first PR of the KORA lazy-assignment spec, lasting opt-outs and the admin per-category view
---

Implements the "Lasting opt-outs" and "Admin view" requirements of `docs/provenance/01a1eaae-fe8a-7000-b0ec-77dbaebdfbd4-kora-lazy-assignment-spec`:

- A participant who opts out of a sensitive category is never given pairs from that category again, in this or any later user-batch or batch. (user-originated)
- There is no way to undo an opt-out in this change. (agent-proposed, user-approved)
- The Kora participants admin page (`/kora-participants`) shows, for each category in the open batches, how many reviews its pairs still need to reach their targets and how many participants have opted out of it. (agent-proposed, user-approved)

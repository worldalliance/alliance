---
user: Charles Lien
task: Stop the review loop from sinking effort into work the user made optional or conditional, and give Open questions their context
---

The provenance skill keeps a requirement's condition ("only if it's easy") in its entry, and has a deferred answer say whether the user left open whether the work happens or how it is done, so a later agent can tell work the user made optional from a choice the user deferred. The fixer prompt's sentence for recording an "I don't care" answer points both answer types at the provenance skill instead of restating the rule, since that sentence is what writes the entry inside the review loop.

Each ledger line names the requirement or decision its finding concerns, since handles and SHAs change between rounds and a fixer needs to find earlier findings on the same work. It names the entry's task and file and quotes words that tell the entry from that file's other entries because provenance entries carry no IDs, a branch can touch several tasks' provenance, and a requirement and a decision can share words, and reuses an earlier round's exact words so names match across fresh fixers even after the entry is reworded.

The Open questions context and per-option pros live in the root `AGENTS.md` rule, which every skill that asks questions already points at; the fixer prompt's report step now points at it too instead of restating part of it.

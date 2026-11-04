---
user: Charles Lien
task: Stop the review loop from sinking effort into work the user made optional or conditional, and give Open questions their context
---

The provenance skill keeps a requirement's condition ("only if it's easy") in its entry, and has a deferred answer say whether the user left open whether the work happens or how it is done, so a later agent can tell work the user made optional from a choice the user deferred. The fixer prompt's sentence for recording an "I don't care" answer points both answer types at the provenance skill instead of restating the rule, since that sentence is what writes the entry inside the review loop.

The Open questions context and per-option pros live in the root `AGENTS.md` rule, which every skill that asks questions already points at; the fixer prompt's report step now points at it too instead of restating part of it.

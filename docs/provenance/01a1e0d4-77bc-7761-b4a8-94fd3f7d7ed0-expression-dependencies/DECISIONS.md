# Decisions

All entries are agent decisions unless they say otherwise.

## Delivery

- **Source maps move to the save-check PR.** The earlier PR's REQUIREMENTS.md (Delivery) listed source maps from the tree to its text with this PR. Their only consumer is the save check's diagnostics, so they ship with the save check, where they have a caller; the plan's PR boundaries were left to the agent.

## Tree

- **One walk order.** `children` in `tree.ts` lists a node's direct subexpressions, so every walk over a tree visits the same parts, and adding a node kind fails the build there until its children are listed.

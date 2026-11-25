# Decisions

All entries are agent decisions unless they say otherwise.

## Delivery

- **Source maps move to the save-check PR.** The earlier PR's REQUIREMENTS.md (Delivery) listed source maps from the tree to its text with this PR. Their only consumer is the save check's diagnostics, so they ship with the save check, where they have a caller; the plan's PR boundaries were left to the agent.

## Tree

- **One walk order.** `children` in `tree.ts` lists a node's direct subexpressions, so every walk over a tree visits the same parts, and adding a node kind fails the build there until its children are listed.
- **One `Math` decoder.** `mathFunctionName` in `tree.ts` decodes the parser's `Math.<name>` call encoding for the interpreter and the dependency reads, so both read a call one way.

## Dependencies

- **Shared ordering.** The depth-first order that the options formulas used (`optionsFormulaOrder`) moves to `common/src/topological-order.ts` as `topologicalOrder`, which takes the roots, a lookup and each item's dependencies, since named expressions need the same walk and cycle report. The options formulas behave as before.
- **What `reads` returns.** `reads` lists the inputs, host functions and named expressions an expression reaches, following named expressions, which splits (same-suite reads, waits) and fill sessions (what to pin) need. `Math` functions and `isUnknown` aren't host functions, so they aren't listed. A reference to a named expression the caller didn't pass is listed but not followed.
- **Cycles by name.** `dependencyOrder` orders the named expressions its roots reach, each after those it references, or fails with the names along a cycle, ending where it started, since an admin reads names, not ids.

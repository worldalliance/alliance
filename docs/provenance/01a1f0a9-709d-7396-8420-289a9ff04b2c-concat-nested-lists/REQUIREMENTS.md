---
user: Charles Lien
task: Fix Linear issue ALL-2346 (the expression save check accepts `concat` of a flat list onto a list of lists, which fails at runtime) on this branch, then open a PR.
---

# Requirements

- Fix ALL-2346: an expression the save check accepts must not hit a runtime type mismatch because `concat` was typed one way and runs another. `[[2]].concat([1])` is the reported case: `tsc` types `[1]` as one item and the result as `number[][]`, while the interpreter spreads it as JavaScript does, giving `[[2], 1]`. (user)
- Make the fix on the `variable-framework` branch and open a PR for it. (user)

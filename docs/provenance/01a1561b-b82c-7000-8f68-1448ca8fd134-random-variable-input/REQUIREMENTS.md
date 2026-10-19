---
user: Alex Dorey
task: Add a seeded `random` input kind for form variables
---

## User-origin requirements

- An action's text can pick from a fixed list, e.g. `Please write a letter to #{recipient}`. Each member gets a pick that looks random, but always sees the same one on every render and every device.
- A sixth variable input kind, `random`, alongside `field`, `list`, `sourceField`, `sourceList` and `aggregate`. It is a kind of its own, so a build that predates it fails the variable instead of misreading it.
- A `random` input resolves to a non-negative integer that depends only on the form, the acting member and the variable name. Different variables on the same form get independent picks.
- A `random` input whose randomization key is missing fails the variable loudly, the way a missing aggregate count does.
- `Math.random` stays banned.
- The web and mobile form renderers pass their existing per-member randomization key (`form:<id>:user:<key>`, falling back to the persist key for anonymous drafts) into variable evaluation.
- The admin `VariableBuilder` offers "Random number (stable per member)" as an input type.
- Admins write formulas like `["Senator Bob", "Congresswoman Suzie", "President Pam"][input1 % 3]`.
- Tests: the same key always gives the same value and different keys spread across indices; a missing key fails the variable; the schema round-trips; the builder offers the new input type.

## Agent-proposed, user-approved

- The value goes through an integer mixing step after the FNV-1a hash, so `input % n` is uniform and independent across variables for any `n`, including powers of two.
- Output views key the value on the member who submitted the response, not the viewer, so another member's output shows the same pick its author saw.
- Admin validation evaluates formulas with a placeholder randomization key, so a valid formula using a `random` input saves.
- Every other branch on input kind handles `random`.

# Decisions

Agent decisions unless labelled otherwise. The research and agent reports behind the questions asked are in `EVIDENCE.md`.

## Names

- **Messages without "input".** Messages the core shows admins say "formula" where they said "named expression". Following the requirement that admins see no umbrella word for what a formula reads, they name the thing (``Nothing here is called `x`.``, `` `x` is already used by something formulas can read. ``) or say "something". A removed input stays unnamed ("This uses something that no longer exists."), since a formula may have taken its id as its name, and naming it would point at the formula.
- **Old builder relabel scope.** Every admin-visible string in the old form builder that names a form variable says "formula": the tab, its heading, its buttons, and the save gate and validation messages, plus the server's delete-refusal message. A new variable's default name (`variable1`) is data, not a label, so it stays.

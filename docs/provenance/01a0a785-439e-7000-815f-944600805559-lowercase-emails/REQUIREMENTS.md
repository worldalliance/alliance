---
user: Charles Lien
task: Normalize stored emails to lowercase and match them exactly
---

# Requirements

- Normalize the emails in the database to be lowercase.
- Fix the bug where email lookup checks `ILIKE` instead of matching exactly.
- The user believed normalization alone would fix the `ILIKE` bug, and asked for
  confirmation. The agent answered that it would not: `ILIKE` treats the input
  as a pattern, so `_` and `%` in an address stay wildcards after lowercasing,
  and the exact-match change is separate and still required.
- When the backfill finds two accounts whose addresses differ only in case, the
  migration aborts with the colliding ids and addresses listed, before changing
  any data, so those accounts get resolved by hand and the migration re-run.
  Chosen by the user from three options offered by the agent (the others:
  keep the oldest and suffix the rest; report-only with no migration yet).

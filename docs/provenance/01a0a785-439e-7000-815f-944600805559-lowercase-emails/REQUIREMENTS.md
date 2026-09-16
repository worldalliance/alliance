---
user: Charles Lien
task: Make emails unique regardless of case and match them exactly
---

# Requirements

- Dedupe emails somehow, using a robust method that's common for this type of
  problem. This replaced an earlier ask to normalize the emails in the database
  to be lowercase.
- Fix the bug where email lookup checks `ILIKE` instead of matching exactly.
- The user believed normalization alone would fix the `ILIKE` bug, and asked for
  confirmation. The agent answered that it would not: `ILIKE` treats the input
  as a pattern, so `_` and `%` in an address stay wildcards after lowercasing,
  and the exact-match change is separate and still required.
- When the migration finds two accounts whose addresses differ only in case, it
  aborts with the colliding ids and addresses listed, before changing any data,
  so those accounts get resolved by hand and the migration re-run.
  Chosen by the user from three options offered by the agent (the others:
  keep the oldest and suffix the rest; report-only with no migration yet).
- The user ran the migration's collision check against prod and got no rows:
  `SELECT string_agg(id || ' ' || to_json(email)::text, ', ' ORDER BY id) FROM "user" GROUP BY lower(email) HAVING count(*) > 1`.

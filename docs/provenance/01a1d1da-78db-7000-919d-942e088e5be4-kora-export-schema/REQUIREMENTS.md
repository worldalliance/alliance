---
user: Alex Dorey
task: Review the user's YAML JSON Schema for the KORA export against the review tool's export schema, then commit it into the repository in an appropriate place.
---

# Requirements

- Commit the KORA citizen-review export schema (the platform-to-KORA delivery of Annex D in KORA_SPEC.md: judgements, skips and reviewers tables plus an export header), as the user wrote it, except where the entries below change it. User-originated.
- It lives at `docs/kora/kora_export.schema.yaml`. Agent-proposed, user-approved.
- Answer values keep the schema's own spellings (`under7`, `7to10`, `18to24`, `55plus`, `native_or_bilingual`, `uncomfortable_at_times`, …) rather than the review tool's (`under_7`, `7_10`, `18_24`, `55_plus`, `native`, `uncomfortable`); whatever produces the export maps onto them. Agent-proposed, user-approved.
- Every profile question offers `prefer_not_to_say`: `is_parent` and `works_with_children` are `yes` / `no` / `prefer_not_to_say` rather than 0/1 flags, `country` is an ISO 3166-1 alpha-2 code or `prefer_not_to_say`, and `age_band`, `english`, `education` and `ai_use` include it. Optional questions are still null when unanswered. Agent-proposed, user-approved.
- A parent may answer `prefer_not_to_say` as a `children_age_bands` value. Agent-proposed, user-approved.
- Each exit-survey question is optional on its own; there is no all-or-nothing rule. Agent-proposed, user-approved.
- The risk enum keeps all 26 risks of Annex C, not only the review tool's current 10. Agent-proposed, user-approved.
- `education` is the enum `secondary`, `some_college`, `bachelor`, `postgraduate`, `prefer_not_to_say`, or null. Agent-proposed, user-approved.
- `q3_text` has no maximum length, only the 10-character minimum. User-originated, against an agent proposal to cap it at 280.

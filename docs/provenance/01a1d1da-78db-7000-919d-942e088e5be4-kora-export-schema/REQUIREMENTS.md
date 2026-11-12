---
user: Alex Dorey
task: Review the user's YAML JSON Schema for the KORA export against the review tool's export schema and commit it into the repository; then review the other KORA spec documents the user pulled and incorporate them.
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

## Other KORA documents

- KORA_SPEC.md (v5.2) is not committed. It stays in `.scratch/` until KORA agrees to its publication, because it names KORA and Alliance staff, its timeline and points still open with KORA. Agent-proposed, user-amended.
- KORA's 10 test pairs (`kora_alliance_test_pairs_10.yaml`) are held back from the repository on the same condition. Agent-proposed, user-approved.
- The spec is amended to agree with the export schema: section 5 offers "prefer not to say" on every profile question and lists the education options, Annex D describes the yes / no / prefer_not_to_say flags, ISO country codes and per-question exit-survey blanks, and a new Annex E entry 24 records the change and section 12 flags it to KORA to confirm or reverse. Agent-proposed, user-approved.
- The pair import schema lives at `docs/kora/kora_pairs.schema.yaml` and the risk taxonomy at `docs/kora/categories_and_risks.yaml`. Agent-proposed, user-approved.
- These YAML files are hand-maintained in the repository: notes telling readers to regenerate them with Python scripts or from JSONL sources the repository does not have are removed. Agent-proposed, user-approved.
- The landing-page copy in `categories_and_risks.yaml` (the `responsible` and `failing` lines) stays, marked as drafted by Claude and awaiting review before publishing. Agent-proposed, user-approved.
- The 20 synthetic example pairs go into `kora-review/test/fixtures/` with a test that checks them against the pair import schema and through `convert.ts`. Agent-proposed, user-approved.
- Bringing the review tool's risk list (`kora-review/src/categories.ts`, 10 risks) to all 26 is a separate change, not part of this one. Agent-proposed, user-approved.

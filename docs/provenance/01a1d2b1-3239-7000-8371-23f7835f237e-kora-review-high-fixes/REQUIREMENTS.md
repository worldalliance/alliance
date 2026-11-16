---
user: Alex Dorey
task: Fix all the HIGH-severity findings from the review of branch alex/kora-review that don't touch the mobile app.
---

- Fix every HIGH-severity finding from the branch review except the one in `apps/mobile` (user-originated). These are the findings:
  - Redacting contact details from a saved Kora export never leaves a field longer than the export schema's `maxLength` for it.
  - The redaction also covers the profile's free-text `country` and `gender`.
  - A KORA pair upload whose turn role isn't `child` or `ai`, whose turn has no text, or which has no `pair_id` or `scenario_title`, is rejected rather than stored with values filled in.
  - When a batch retire or delete completes a member's first assignment, the member's Kora review action completes, and on staging the assignment-completed batch event is recorded, as when they finish it themselves.
  - `kora-review/src/style.css` meets the 500-line file-size rule.
  - `yaml` is declared in `apps/frontend/package.json` with kora-review's range.

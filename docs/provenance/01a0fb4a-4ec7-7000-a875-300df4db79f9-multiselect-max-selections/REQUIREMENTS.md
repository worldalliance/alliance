---
user: Charles Lien
task: Deduplicate the multiselect maxSelections cap rule
---

Find duplicated code and dedup one item in a standalone commit, chosen so that things likely to change together have a single source of truth and behavior cannot diverge, not by lines deleted.

From the agent's proposed list, the user picked "fix 2". Agent-authored context for item 2: the server, `shared/formrenderer.ts`, and `sharedweb/forms/RenderField.tsx` each treat a multiselect `maxSelections` of 0 or less as no cap, while mobile `RenderField` treats any defined value as a cap, so `maxSelections: 0` disables every option and shows "Select up to 0 options" on mobile only. The proposal was one `effectiveMaxSelections(field)` helper in `common/forms`.

# Decisions

- **The plain card picks the thumbnail path by field kind (file or image), not by whether the answer has file values.** `getOutputFileValues` counts every non-empty string answer as a file value, so the earlier check sent text answers to the 14px non-plain style and lost their line breaks. (agent decision, from review finding `strings-as-files`)
- **Unselected wheel numbers are `zinc-600`**, the nearest grey to the design's that meets WCAG AA's 4.5:1 for text: about 7:1 on the `zinc-100` wheel, where the design's `zinc-500` is about 4.4:1. Supersedes the `zinc-500` entry in `01a1efbf-56c3-7000-b770-98e1ac50e663-onboarding-task-polish/DECISIONS.md`. (agent decision, from review finding `unselected-contrast`)
- **The dark number is the row under the band, updated as the column scrolls**, not only once the scroll settles. (agent decision, from review finding `stale-selected-colour`)

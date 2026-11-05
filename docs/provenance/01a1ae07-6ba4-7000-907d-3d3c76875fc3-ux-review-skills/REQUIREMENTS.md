---
user: Charles Lien
task: A workflow that compares the Alliance's UI with similar established products (screenshots taken or found online), has a mix of Claude and Codex judges compare polish, UI, UX and friction and suggest items, and has agents build alternative prototypes the user picks from, without implementing the items; plus a skill holding the industry-standard UI and UX guidelines, for the Alliance agent desktop app and the main Alliance product
---

## Guidelines skill

- A skill, `agents/skills/ux-guidelines/`, holds the researched UI and UX checklist: WCAG 2.2 AA, platform conventions, system status, errors and recovery, forms, empty states, destructive actions and the like, each item with its source and whether it is a formal standard, a platform vendor recommendation, a research-backed practice or common practice. (agent-proposed, user-approved)
- The root `AGENTS.md` points agents to it before any UI change in `apps/` or `agents/desktop`, and the comparison workflow's judges score against the same file. (agent-proposed, user-approved)
- Icons stand alone only for universally recognised actions (close, search, send, delete, settings); every other action carries a visible word. This rule lives in the guidelines skill. (agent-proposed, user-approved)
- The guidelines skill's icons rule supersedes the constraint "Icons over text labels (`lucide-react`); every icon-only control carries a tooltip or `aria-label`" recorded in `docs/provenance/01a0b185-0403-7000-841f-9499984a8236-responses-table-view/REQUIREMENTS.md`, which stays as written. (user-originated)
- This task changes docs and skills only. Migrating the existing icon-only controls built under the old icons-first rule to the new icons rule, and a lint ratchet against new ones, are separate work, Linear ALL-2080. (agent-proposed, user-approved)

## Research records

- A task's research goes in an `EVIDENCE.md` in its provenance directory, and a skill agents reach says so. (user-originated)

## Other tasks' provenance

- Another task's provenance is never edited; a later task supersedes it in its own provenance. (user-originated)

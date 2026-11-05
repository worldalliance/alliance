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

## Comparison workflow

- The workflow is a skill. (user-originated)
- It suggests items and builds prototypes; it never implements the items. (user-originated)
- Each run covers one surface or flow, such as the chat view, New task or member onboarding, against the running app. (agent-proposed, user-approved)
- Each run asks the user where the reference products' screenshots come from: captured live where possible (Playwright for web apps, screen capture for installed desktop apps) with web search for official screenshots and docs as the fallback, web search only, or supplied by the user. (user-originated)
- Two Claude and two Codex judges each review the same material independently against the guidelines skill, from prompts that carry nothing from the other judges or from the agent running the workflow. A final agent merges duplicates and ranks the items, noting where judges and models agreed. (agent-proposed, user-approved; prompt independence user-originated)
- A prototype is a real change to the app in its own child worktree, never merged, screenshotted for comparison and runnable by the user. (agent-proposed, user-approved)
- Each run asks the user which items to prototype, and builds two or three variants of each item they choose. (user-originated)
- The run ends with a report in `.scratch/`: our screenshots beside the reference products' and the prototypes', the options for each item and the judges' reasoning. The workflow says nothing about what happens to the user's picks; that is left to the conversation. (user-originated)

## Research records

- A task's research goes in an `EVIDENCE.md` in its provenance directory, and a skill agents reach says so. (user-originated)

## Other tasks' provenance

- Another task's provenance is never edited; a later task supersedes it in its own provenance. (user-originated)
